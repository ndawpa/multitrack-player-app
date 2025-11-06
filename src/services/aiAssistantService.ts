import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Song } from '../types/song';
import AuthService from './authService';
import SongAccessService from './songAccessService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIConfig {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  provider?: 'openai' | 'anthropic' | 'google';
}

class AIAssistantService {
  private static instance: AIAssistantService;
  private authService: AuthService;
  private songAccessService: SongAccessService;
  private config: AIConfig = {
    provider: 'openai',
    model: 'gpt-4o-mini', // Using a cost-effective model
  };

  private constructor() {
    this.authService = AuthService.getInstance();
    this.songAccessService = SongAccessService.getInstance();
  }

  public static getInstance(): AIAssistantService {
    if (!AIAssistantService.instance) {
      AIAssistantService.instance = new AIAssistantService();
    }
    return AIAssistantService.instance;
  }

  /**
   * Configure AI service with API key and settings
   */
  public configure(config: AIConfig): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get all accessible songs from database (not just those with lyrics)
   * Optimized to check access in-memory instead of making individual queries
   */
  private async getAccessibleSongs(): Promise<Song[]> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.log('No user logged in');
      return [];
    }

    try {
      console.log('Fetching all songs from Firebase...');
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        console.log('No songs found in database');
        return [];
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      console.log(`Found ${songEntries.length} total songs in database`);

      // Pre-fetch user groups once instead of checking for each song
      console.log('Fetching user groups...');
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
        console.log(`User is in ${userGroupIds.length} groups`);
      }

      // Check access in-memory for all songs
      console.log('Checking access for songs...');
      const accessibleSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        // Check access in-memory (much faster than individual queries)
        const songDataTyped = songData as any;
        let hasAccess = false;
        
        // If no access control, song is public
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          
          // Check if song is public
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          }
          // Check if user is the creator
          else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          }
          // Check if user is in allowed users list
          else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          }
          // Check if user is in any allowed groups
          else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (hasAccess) {
          const song = {
            id: songId,
            ...songDataTyped
          } as Song;
          
          // Include ALL accessible songs (not just those with lyrics)
          accessibleSongs.push(song);
        }
      }

      console.log(`Found ${accessibleSongs.length} accessible songs`);
      
      // Provider-specific limits based on their context window capabilities
      // OpenAI: ~128k tokens (gpt-4o), ~16k tokens (gpt-3.5-turbo)
      // Google Gemini: ~1M tokens (gemini-1.5-pro), ~32k tokens (gemini-pro) - can handle ALL songs!
      // Anthropic: ~200k tokens (claude-3-opus), ~100k tokens (claude-3-sonnet)
      const provider = this.config.provider || 'openai';
      let maxSongs: number;
      
      switch (provider) {
        case 'google':
          // Gemini can handle very large contexts - send everything!
          maxSongs = Infinity; // No limit for Google
          console.log(`Google Gemini selected - sending ALL ${accessibleSongs.length} songs (no limit)`);
          break;
        case 'anthropic':
          // Claude also supports large contexts
          maxSongs = 150;
          break;
        case 'openai':
        default:
          // OpenAI models have smaller context windows
          maxSongs = 50;
          break;
      }
      
      const limitedSongs = maxSongs === Infinity 
        ? accessibleSongs 
        : accessibleSongs.slice(0, maxSongs);
      
      if (maxSongs !== Infinity && accessibleSongs.length > maxSongs) {
        console.log(`Limiting to ${maxSongs} songs (out of ${accessibleSongs.length}) for ${provider} provider`);
      }
      
      return limitedSongs;
    } catch (error) {
      console.error('Error fetching songs with lyrics:', error);
      return [];
    }
  }

  /**
   * Format songs data for AI context
   * Includes ALL song information: metadata, lyrics, tracks, scores, resources
   * Optimized to limit context size and truncate long lyrics
   * Limits are provider-specific based on context window capabilities
   */
  private formatSongsForContext(songs: Song[]): string {
    if (songs.length === 0) {
      return 'No songs are available in the database.';
    }

    // Provider-specific limits
    const provider = this.config.provider || 'openai';
    let maxLyricsLength: number;
    
    switch (provider) {
      case 'google':
        // Gemini can handle very large contexts - send full lyrics!
        maxLyricsLength = Infinity; // No truncation for Google
        break;
      case 'anthropic':
        // Claude can also handle longer content
        maxLyricsLength = 800;
        break;
      case 'openai':
      default:
        // OpenAI models need shorter lyrics
        maxLyricsLength = 500;
        break;
    }
    
    const songsToInclude = songs; // Already limited in getAccessibleSongs
    const totalSongs = songs.length;
    
    let context = `The user has access to ${totalSongs} songs in their music library. `;
    if (songs.length > songsToInclude.length) {
      context += `Showing ${songsToInclude.length} songs:\n\n`;
    } else {
      context += `\n\n`;
    }
    
    songsToInclude.forEach((song, index) => {
      context += `Song ${index + 1}:\n`;
      context += `- ID: ${song.id}\n`;
      context += `- Title: "${song.title}"\n`;
      context += `- Artist: "${song.artist}"\n`;
      if (song.album) {
        context += `- Album: "${song.album}"\n`;
      }
      if (song.createdBy) {
        context += `- Created by user ID: ${song.createdBy}\n`;
      }
      if (song.createdAt) {
        context += `- Created at: ${song.createdAt}\n`;
      }
      
      // Include lyrics (if available)
      if (song.lyrics && song.lyrics.trim().length > 0) {
        let lyrics = song.lyrics;
        if (maxLyricsLength !== Infinity && lyrics.length > maxLyricsLength) {
          lyrics = lyrics.substring(0, maxLyricsLength) + '... (truncated)';
        }
        context += `- Lyrics:\n${lyrics}\n`;
      } else {
        context += `- Lyrics: (no lyrics available)\n`;
      }
      
      // Include tracks (audio files) - metadata only
      if (song.tracks && song.tracks.length > 0) {
        context += `- Audio Tracks (${song.tracks.length}):\n`;
        song.tracks.forEach((track, trackIndex) => {
          context += `  Track ${trackIndex + 1}: "${track.name}" (path: ${track.path})\n`;
        });
      } else {
        context += `- Audio Tracks: (no tracks available)\n`;
      }
      
      // Include scores (PDFs) - metadata and URLs only
      if (song.scores && song.scores.length > 0) {
        context += `- Scores/PDFs (${song.scores.length}):\n`;
        song.scores.forEach((score, scoreIndex) => {
          context += `  Score ${scoreIndex + 1}: "${score.name}"`;
          if (score.url) {
            context += ` (URL: ${score.url})`;
          }
          if (score.pages && score.pages.length > 0) {
            context += ` (${score.pages.length} pages)`;
          }
          context += `\n`;
        });
      } else {
        context += `- Scores/PDFs: (no scores available)\n`;
      }
      
      // Include resources (links, YouTube, downloads, etc.)
      if (song.resources && song.resources.length > 0) {
        context += `- Resources (${song.resources.length}):\n`;
        song.resources.forEach((resource, resourceIndex) => {
          context += `  Resource ${resourceIndex + 1}: "${resource.name}" (Type: ${resource.type})`;
          if (resource.url) {
            context += ` (URL: ${resource.url})`;
          }
          if (resource.description) {
            context += ` - ${resource.description}`;
          }
          context += `\n`;
        });
      } else {
        context += `- Resources: (no resources available)\n`;
      }
      
      // Include access control information
      if (song.accessControl) {
        context += `- Access Control:\n`;
        context += `  Visibility: ${song.accessControl.visibility}\n`;
        context += `  Access Level: ${song.accessControl.accessLevel}\n`;
        if (song.accessControl.allowedUsers && song.accessControl.allowedUsers.length > 0) {
          context += `  Allowed Users: ${song.accessControl.allowedUsers.length} user(s)\n`;
        }
        if (song.accessControl.allowedGroups && song.accessControl.allowedGroups.length > 0) {
          context += `  Allowed Groups: ${song.accessControl.allowedGroups.length} group(s)\n`;
        }
      }
      
      context += `\n`;
    });

    return context;
  }

  /**
   * Extract keywords and themes from user question for smart song filtering
   */
  private extractKeywordsFromQuestion(question: string): string[] {
    const questionLower = question.toLowerCase();
    const keywords: string[] = [];
    
    // Common question patterns
    const questionPatterns = [
      /(?:find|show|list|search|which|what).*?(?:song|songs|track|tracks)/gi,
      /(?:about|related to|with|containing|mentioning|having)\s+([^?.,!]+)/gi,
      /(?:theme|topic|subject|mood|feeling|emotion)\s+(?:of|is|are)?\s*([^?.,!]+)/gi,
      /(?:word|phrase|term|lyric|lyrics)\s+["']([^"']+)["']/gi,
    ];
    
    // Extract quoted terms
    const quotedTerms = question.match(/["']([^"']+)["']/g);
    if (quotedTerms) {
      quotedTerms.forEach(term => {
        const cleanTerm = term.replace(/["']/g, '').trim();
        if (cleanTerm.length > 2) {
          keywords.push(cleanTerm);
        }
      });
    }
    
    // Extract words after common question words
    const afterKeywords = ['about', 'with', 'containing', 'mentioning', 'related to', 'theme', 'topic'];
    afterKeywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}\\s+([^?.,!]+)`, 'gi');
      const matches = question.match(regex);
      if (matches) {
        matches.forEach(match => {
          const extracted = match.replace(new RegExp(keyword, 'gi'), '').trim();
          if (extracted.length > 2) {
            keywords.push(extracted);
          }
        });
      }
    });
    
    // Extract individual significant words (3+ characters, not common words)
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about', 'into', 'through', 'during', 'including', 'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'including', 'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'where', 'when', 'why', 'how', 'find', 'show', 'list', 'search', 'song', 'songs', 'track', 'tracks']);
    const words = questionLower.split(/\s+/).filter(word => {
      const cleanWord = word.replace(/[^a-z0-9]/g, '');
      return cleanWord.length >= 3 && !commonWords.has(cleanWord);
    });
    keywords.push(...words);
    
    // Remove duplicates and return
    return [...new Set(keywords)].slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Smart song filtering - only include songs relevant to the question
   */
  private filterRelevantSongs(songs: Song[], question: string): Song[] {
    if (songs.length === 0) {
      return songs;
    }
    
    const keywords = this.extractKeywordsFromQuestion(question);
    const questionLower = question.toLowerCase();
    
    // If no meaningful keywords found, return a sample (for general questions)
    if (keywords.length === 0) {
      console.log('No specific keywords found, using sample of songs for general question');
      return songs.slice(0, 20); // Return first 20 for general questions
    }
    
    console.log('Extracted keywords from question:', keywords);
    
    // Score songs based on relevance
    const scoredSongs = songs.map(song => {
      let score = 0;
      const titleLower = (song.title || '').toLowerCase();
      const artistLower = (song.artist || '').toLowerCase();
      const albumLower = (song.album || '').toLowerCase();
      const lyricsLower = (song.lyrics || '').toLowerCase();
      
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // Title match (highest weight)
        if (titleLower.includes(keywordLower)) {
          score += 10;
        }
        
        // Artist match (high weight)
        if (artistLower.includes(keywordLower)) {
          score += 8;
        }
        
        // Album match
        if (albumLower.includes(keywordLower)) {
          score += 6;
        }
        
        // Lyrics match (lower weight, but check multiple times)
        const lyricsMatches = (lyricsLower.match(new RegExp(keywordLower, 'g')) || []).length;
        score += Math.min(lyricsMatches * 2, 10); // Cap at 10 points per keyword
        
        // Check resources
        if (song.resources) {
          song.resources.forEach(resource => {
            const resourceName = (resource.name || '').toLowerCase();
            const resourceDesc = (resource.description || '').toLowerCase();
            if (resourceName.includes(keywordLower) || resourceDesc.includes(keywordLower)) {
              score += 3;
            }
          });
        }
      });
      
      return { song, score };
    });
    
    // Filter songs with score > 0 and sort by score
    const relevantSongs = scoredSongs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.song);
    
    // If we found relevant songs, return top matches (limit based on provider)
    if (relevantSongs.length > 0) {
      const provider = this.config.provider || 'openai';
      const maxRelevant = provider === 'google' ? 50 : provider === 'anthropic' ? 30 : 20;
      const topRelevant = relevantSongs.slice(0, maxRelevant);
      console.log(`Found ${relevantSongs.length} relevant songs, using top ${topRelevant.length}`);
      return topRelevant;
    }
    
    // If no matches, return a small sample for context
    console.log('No exact matches found, using sample of songs');
    return songs.slice(0, 10);
  }

  /**
   * Query AI with user question and smart song context selection
   * Only sends relevant songs instead of all songs for better performance and cost
   */
  public async askQuestion(question: string, chatHistory: ChatMessage[] = []): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('AI API key not configured. Please set your API key in the settings.');
    }

    if (!this.config.provider) {
      throw new Error('AI provider not configured. Please select a provider in the settings.');
    }

    console.log('AI Assistant - askQuestion called:', {
      questionLength: question.length,
      chatHistoryLength: chatHistory.length,
      provider: this.config.provider,
      model: this.config.model,
      hasApiKey: !!this.config.apiKey
    });

    try {
      // Get all accessible songs first
      console.log('Fetching all accessible songs...');
      const allSongs = await this.getAccessibleSongs();
      console.log(`Found ${allSongs.length} accessible songs`);
      
      // Smart filtering: only get relevant songs based on the question
      console.log('Filtering relevant songs based on question...');
      const relevantSongs = this.filterRelevantSongs(allSongs, question);
      console.log(`Selected ${relevantSongs.length} relevant songs (out of ${allSongs.length})`);
      
      const songsContext = this.formatSongsForContext(relevantSongs);
      console.log(`Formatted context length: ${songsContext.length} characters (reduced from potential ${allSongs.length} songs)`);

      // Build system prompt
      const totalSongsCount = allSongs.length;
      const systemPrompt = `You are a helpful AI assistant for a music multitrack player app. The user has a library of ${totalSongsCount} songs, but I'm providing you with the most relevant songs based on their question to keep the response fast and cost-effective.

Your role is to:
1. Help users find songs based on themes, topics, lyrics content, or any song attributes
2. Answer questions about songs in their library (metadata, tracks, scores, resources)
3. Analyze lyrics and provide insights
4. Suggest songs based on themes, moods, or any criteria
5. Help users understand what resources are available for each song (tracks, scores, links)
6. Provide information about audio tracks, PDF scores, and external resources

IMPORTANT: 
- Only reference songs that are in the user's library
- You have access to complete song information including tracks, scores, and resources
- Audio files and PDFs are stored in the cloud - you can reference their names and paths, but cannot access the actual binary content
- The songs provided below are the most relevant matches. If you need to search more broadly, mention that the user can refine their question
- If a song is not in the provided context, politely let the user know and suggest they try a more specific search

Here are the most relevant songs from the user's library (${relevantSongs.length} out of ${totalSongsCount} total songs):
${songsContext}

Please provide helpful, accurate responses based on this information.`;

      // Build messages array
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt }
      ];

      // Add chat history (last 10 messages to avoid token limits)
      const recentHistory = chatHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // Add current question
      messages.push({
        role: 'user',
        content: question
      });

      console.log(`Sending request to ${this.config.provider} with ${messages.length} messages`);

      // Call AI API based on provider
      const response = await this.callAIAPI(messages);
      console.log('AI response received, length:', response.length);
      return response;
    } catch (error: any) {
      console.error('Error asking AI question:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Call AI API based on configured provider
   */
  private async callAIAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const { provider, apiKey, model, baseURL } = this.config;

    switch (provider) {
      case 'openai':
        return this.callOpenAI(messages, apiKey!, model!, baseURL);
      case 'anthropic':
        return this.callAnthropic(messages, apiKey!, model!);
      case 'google':
        return this.callGoogle(messages, apiKey!, model!);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string,
    baseURL?: string
  ): Promise<string> {
    const url = baseURL || 'https://api.openai.com/v1/chat/completions';
    
    const requestBody = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    };

    console.log('OpenAI API Request:', {
      url,
      model,
      messageCount: messages.length,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 7)}...` : 'missing'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('OpenAI API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error Response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText || 'Unknown error' } };
        }
        throw new Error(`OpenAI API error (${response.status}): ${errorData.error?.message || JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('OpenAI API Success Response:', {
        hasChoices: !!data.choices,
        choiceCount: data.choices?.length || 0
      });
      return data.choices[0]?.message?.content || 'No response from AI';
    } catch (error: any) {
      console.error('OpenAI API Fetch Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      // Check if it's a network error
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to reach OpenAI API. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  /**
   * Call Anthropic Claude API
   */
  private async callAnthropic(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string
  ): Promise<string> {
    // Filter out system message and convert format for Anthropic
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text: msg.content }]
      }));

    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemMessage,
        messages: anthropicMessages
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Anthropic API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response from AI';
  }

  /**
   * Call Google Gemini API
   */
  private async callGoogle(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string
  ): Promise<string> {
    // Convert messages to Gemini format
    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    const systemInstruction = messages.find(msg => msg.role === 'system')?.content || '';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Google API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response from AI';
  }

  /**
   * Quick search for songs by theme (simpler, faster method)
   */
  public async searchSongsByTheme(theme: string): Promise<Song[]> {
    const songs = await this.getAccessibleSongs();
    
    if (songs.length === 0) {
      return [];
    }

    // Simple keyword-based search (can be enhanced with AI)
    const themeLower = theme.toLowerCase();
    const matchingSongs = songs.filter(song => {
      const lyricsLower = (song.lyrics || '').toLowerCase();
      const titleLower = (song.title || '').toLowerCase();
      const artistLower = (song.artist || '').toLowerCase();
      
      return lyricsLower.includes(themeLower) || 
             titleLower.includes(themeLower) || 
             artistLower.includes(themeLower);
    });

    return matchingSongs;
  }
}

export default AIAssistantService;
export type { ChatMessage, AIConfig };

