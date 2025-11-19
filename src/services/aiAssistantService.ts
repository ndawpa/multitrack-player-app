import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Song } from '../types/song';
import { Playlist } from '../types/playlist';
import { UserGroup } from '../types/group';
import AuthService from './authService';
import SongAccessService from './songAccessService';
import AIAssistantAccessService from './aiAssistantAccessService';
import PlaylistService from './playlistService';
import GroupService from './groupService';
import MCPClientService, { MCPToolCall } from './mcpClientService';

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
  enableMCP?: boolean; // Enable MCP (Model Context Protocol) tools
}

class AIAssistantService {
  private static instance: AIAssistantService;
  private authService: AuthService;
  private songAccessService: SongAccessService;
  private accessService: AIAssistantAccessService;
  private playlistService: PlaylistService;
  private groupService: GroupService;
  private mcpClient: MCPClientService;
  private config: AIConfig = {
    provider: 'google',
    model: 'gemini-2.5-flash-lite', // Using Google Gemini
    enableMCP: true, // Enable MCP by default
  };

  private constructor() {
    this.authService = AuthService.getInstance();
    this.songAccessService = SongAccessService.getInstance();
    this.accessService = AIAssistantAccessService.getInstance();
    this.playlistService = PlaylistService.getInstance();
    this.groupService = GroupService.getInstance();
    this.mcpClient = MCPClientService.getInstance();
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
   * Load AI configuration from Firebase
   */
  public async loadConfigFromFirebase(): Promise<void> {
    try {
      const aiConfig = await this.accessService.getAIConfig();
      if (aiConfig && aiConfig.apiKey) {
        this.config = {
          apiKey: aiConfig.apiKey,
          provider: aiConfig.provider || 'google',
          model: aiConfig.model || 'gemini-2.5-flash-lite'
        };
        console.log('AI configuration loaded from Firebase:', {
          provider: this.config.provider,
          model: this.config.model,
          hasApiKey: !!this.config.apiKey
        });
      } else {
        console.log('No AI configuration found in Firebase');
      }
    } catch (error) {
      console.error('Error loading AI config from Firebase:', error);
    }
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
      const provider = this.config.provider || 'google';
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
   * Get all playlists for the current user
   */
  private async getUserPlaylists(): Promise<Playlist[]> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return [];
    }

    try {
      const playlists = await this.playlistService.getUserPlaylists(user.id);
      console.log(`Found ${playlists.length} playlists for user`);
      return playlists;
    } catch (error) {
      console.error('Error fetching playlists:', error);
      return [];
    }
  }

  /**
   * Get all user groups the current user belongs to
   */
  private async getUserGroups(): Promise<UserGroup[]> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return [];
    }

    try {
      const groups = await this.groupService.getUserGroups(user.id);
      console.log(`Found ${groups.length} groups for user`);
      return groups;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  }

  /**
   * Format lightweight summary context for AI (MCP-enabled mode)
   * Provides statistics and overview, not full data
   */
  private formatSummaryContext(
    songs: Song[],
    playlists: Playlist[],
    groups: UserGroup[],
    enableMCP: boolean
  ): string {
    let summary = '';

    // Songs summary
    summary += `SONGS:\n`;
    summary += `- Total songs: ${songs.length}\n`;
    
    if (songs.length > 0) {
      // Count songs with lyrics
      const songsWithLyrics = songs.filter(s => s.lyrics && s.lyrics.trim().length > 0).length;
      summary += `- Songs with lyrics: ${songsWithLyrics}\n`;
      
      // Count songs with tracks
      const songsWithTracks = songs.filter(s => s.tracks && s.tracks.length > 0).length;
      summary += `- Songs with audio tracks: ${songsWithTracks}\n`;
      
      // Count songs with scores
      const songsWithScores = songs.filter(s => s.scores && s.scores.length > 0).length;
      summary += `- Songs with scores/PDFs: ${songsWithScores}\n`;
      
      // Get unique artists
      const artists = new Set(songs.map(s => s.artist).filter(Boolean));
      summary += `- Unique artists: ${artists.size}\n`;
      
      // Get unique albums
      const albums = new Set(songs.map(s => s.album).filter(Boolean));
      summary += `- Unique albums: ${albums.size}\n`;
      
      // Show sample of songs (first 30 titles and artists only)
      const sampleSize = Math.min(30, songs.length);
      summary += `\nSample of songs (${sampleSize} of ${songs.length}):\n`;
      songs.slice(0, sampleSize).forEach((song, index) => {
        summary += `${index + 1}. "${song.title}" by ${song.artist || 'Unknown'}`;
        if (song.album) summary += ` (Album: ${song.album})`;
        summary += ` [ID: ${song.id}]\n`;
      });
      
      if (songs.length > sampleSize) {
        summary += `... and ${songs.length - sampleSize} more songs. Use MCP tools to search for specific songs.\n`;
      }
    } else {
      summary += `- No songs available.\n`;
    }

    // Playlists summary
    summary += `\nPLAYLISTS:\n`;
    summary += `- Total playlists: ${playlists.length}\n`;
    
    if (playlists.length > 0) {
      const totalPlaylistSongs = playlists.reduce((sum, p) => sum + (p.songs?.length || 0), 0);
      summary += `- Total songs across all playlists: ${totalPlaylistSongs}\n`;
      
      // Show playlist names only (first 20)
      const sampleSize = Math.min(20, playlists.length);
      summary += `\nPlaylist names (${sampleSize} of ${playlists.length}):\n`;
      playlists.slice(0, sampleSize).forEach((playlist, index) => {
        summary += `${index + 1}. "${playlist.name}" (${playlist.songs?.length || 0} songs) [ID: ${playlist.id}]\n`;
      });
      
      if (playlists.length > sampleSize) {
        summary += `... and ${playlists.length - sampleSize} more playlists. Use MCP tools to get detailed playlist information.\n`;
      }
    } else {
      summary += `- No playlists available.\n`;
    }

    // Groups summary
    summary += `\nUSER GROUPS:\n`;
    summary += `- Total groups: ${groups.length}\n`;
    
    if (groups.length > 0) {
      const sampleSize = Math.min(20, groups.length);
      summary += `\nGroup names (${sampleSize} of ${groups.length}):\n`;
      groups.slice(0, sampleSize).forEach((group, index) => {
        summary += `${index + 1}. "${group.name}" (${group.members?.length || 0} members) [ID: ${group.id}]\n`;
      });
      
      if (groups.length > sampleSize) {
        summary += `... and ${groups.length - sampleSize} more groups. Use MCP tools to get detailed group information.\n`;
      }
    } else {
      summary += `- User is not a member of any groups.\n`;
    }

    if (enableMCP) {
      summary += `\n\nNOTE: This is a summary only. For detailed information about specific songs, playlists, or groups, use the MCP tools (search_songs, get_song_details, get_playlists, get_user_groups, etc.).`;
    }

    return summary;
  }

  /**
   * Format playlists data for AI context
   */
  private formatPlaylistsForContext(playlists: Playlist[]): string {
    if (playlists.length === 0) {
      return 'No playlists are available.';
    }

    let context = `The user has ${playlists.length} playlist(s):\n\n`;
    
    playlists.forEach((playlist, index) => {
      context += `Playlist ${index + 1}:\n`;
      context += `- ID: ${playlist.id}\n`;
      context += `- Name: "${playlist.name}"\n`;
      if (playlist.description) {
        context += `- Description: "${playlist.description}"\n`;
      }
      context += `- Created: ${playlist.createdAt instanceof Date ? playlist.createdAt.toISOString() : playlist.createdAt}\n`;
      context += `- Updated: ${playlist.updatedAt instanceof Date ? playlist.updatedAt.toISOString() : playlist.updatedAt}\n`;
      context += `- Public: ${playlist.isPublic ? 'Yes' : 'No'}\n`;
      context += `- Play Count: ${playlist.playCount}\n`;
      if (playlist.lastPlayedAt) {
        context += `- Last Played: ${playlist.lastPlayedAt instanceof Date ? playlist.lastPlayedAt.toISOString() : playlist.lastPlayedAt}\n`;
      }
      
      if (playlist.songs && playlist.songs.length > 0) {
        context += `- Songs (${playlist.songs.length}):\n`;
        playlist.songs.forEach((item, songIndex) => {
          context += `  ${songIndex + 1}. "${item.songTitle}" by ${item.songArtist} (Song ID: ${item.songId}, Position: ${item.position})`;
          if (item.notes) {
            context += ` - Notes: ${item.notes}`;
          }
          context += `\n`;
        });
      } else {
        context += `- Songs: (no songs in playlist)\n`;
      }
      
      context += `\n`;
    });

    return context;
  }

  /**
   * Format user groups data for AI context
   */
  private formatUserGroupsForContext(groups: UserGroup[]): string {
    if (groups.length === 0) {
      return 'The user is not a member of any groups.';
    }

    let context = `The user is a member of ${groups.length} group(s):\n\n`;
    
    groups.forEach((group, index) => {
      context += `Group ${index + 1}:\n`;
      context += `- ID: ${group.id}\n`;
      context += `- Name: "${group.name}"\n`;
      if (group.description) {
        context += `- Description: "${group.description}"\n`;
      }
      context += `- Members: ${group.members?.length || 0} member(s)\n`;
      context += `- Created: ${group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt}\n`;
      if (group.isAdmin) {
        context += `- Admin Group: Yes (members have admin access)\n`;
      }
      context += `\n`;
    });

    return context;
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
      const provider = this.config.provider || 'google';
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
   * Check if user has access to AI Assistant
   */
  public async checkAccess(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return false;
    }
    return await this.accessService.checkUserAccess(user.id);
  }

  /**
   * Query AI with user question and full database context
   * Sends ALL accessible songs, playlists, and user groups for complete context
   */
  public async askQuestion(question: string, chatHistory: ChatMessage[] = []): Promise<string> {
    // Check access first
    const hasAccess = await this.checkAccess();
    if (!hasAccess) {
      throw new Error('You do not have access to the AI Assistant. Please contact your administrator if you believe this is an error.');
    }

    // Load config from Firebase if not already configured
    if (!this.config.apiKey) {
      await this.loadConfigFromFirebase();
    }

    if (!this.config.apiKey) {
      throw new Error('AI API key not configured. Please contact your administrator to set up the API key.');
    }

    if (!this.config.provider) {
      throw new Error('AI provider not configured. Please contact your administrator to configure the AI Assistant.');
    }

    console.log('AI Assistant - askQuestion called:', {
      questionLength: question.length,
      chatHistoryLength: chatHistory.length,
      provider: this.config.provider,
      model: this.config.model,
      hasApiKey: !!this.config.apiKey
    });

    try {
      // With MCP enabled, we use a lightweight summary approach
      // The AI can use MCP tools to query detailed information when needed
      const enableMCP = this.config.enableMCP !== false;
      
      // Get data
      console.log('Fetching library data...');
      const allSongs = await this.getAccessibleSongs();
      const playlists = await this.getUserPlaylists();
      const userGroups = await this.getUserGroups();
      
      console.log(`Found ${allSongs.length} accessible songs, ${playlists.length} playlists, ${userGroups.length} groups`);
      
      // Format context based on MCP mode
      let contextData: string;
      if (enableMCP) {
        // Use lightweight summary when MCP is enabled
        contextData = this.formatSummaryContext(allSongs, playlists, userGroups, enableMCP);
        console.log(`Using MCP-enabled mode: summary context (${contextData.length} characters)`);
      } else {
        // Use full context when MCP is disabled (legacy mode)
        const songsContext = this.formatSongsForContext(allSongs);
        const playlistsContext = this.formatPlaylistsForContext(playlists);
        const groupsContext = this.formatUserGroupsForContext(userGroups);
        contextData = `SONGS (${allSongs.length} total songs):\n${songsContext}\n\nPLAYLISTS:\n${playlistsContext}\n\nUSER GROUPS:\n${groupsContext}`;
        console.log(`Using full context mode: ${contextData.length} characters`);
      }

      // Build system prompt with summary context (MCP tools handle detailed queries)
      let systemPrompt = `You are a specialized AI assistant for a music multitrack player app. Your purpose is to help users with questions about their complete music library, including songs, playlists, and groups.

STRICT SCOPE LIMITATIONS:
- You MUST ONLY answer questions about the user's music library, playlists, and groups
- You MUST NOT answer general knowledge questions, trivia, or questions unrelated to the user's music library
- You MUST NOT provide information about songs not in the user's library
- You MUST NOT answer questions about music theory, general music history, or artists not in their library
- If asked about something unrelated to their music library, politely redirect: "I can only help you with questions about your music library, playlists, and groups. Would you like to search for something specific?"

Your role includes:
1. Help users find songs in their library based on themes, topics, lyrics content, or song attributes
2. Answer questions about songs in their library (metadata, tracks, scores, resources)
3. Analyze lyrics from songs in their library and provide insights
4. Suggest songs from their library based on themes, moods, or criteria
5. Help users understand what resources are available for each song (tracks, scores, links)
6. Provide information about audio tracks, PDF scores, and external resources for songs in their library
7. Answer questions about playlists (contents, organization, song order)
8. Help users understand their group memberships and access permissions
9. Suggest playlist organization or song groupings based on themes

IMPORTANT RULES: 
- You have COMPLETE access to ALL data in the project through MCP tools including: songs, playlists, groups, user data, access controls, song states, track states, favorites, statistics, and more
- Use MCP tools to query ANY information when needed - there are tools for every type of data in the system
- You CAN access and provide URLs/paths for: audio tracks (path field), PDF scores (url or pages array), and external resources (url field)
- When users ask for download links, file locations, or URLs, use get_song_details, get_song_by_title, or get_song_resources tools
- All tools return full URLs/paths that can be shared with users to access files
- You can access user profile data, preferences, stats, playlists, groups, song access controls, playback states, track states - EVERYTHING
- Use "get_all_user_data" to get comprehensive information about the user's entire account
- If asked about anything outside the scope of their music library, politely decline and redirect to their library`;

      // Add MCP tools information (always show when MCP is enabled)
      if (enableMCP) {
        const mcpToolsDescription = this.mcpClient.getToolsDescription();
        systemPrompt += `\n\n=== MCP (MODEL CONTEXT PROTOCOL) TOOLS ===\n\nYou have COMPLETE access to ALL data in the project through these MCP tools. USE THESE TOOLS to access ANY information:\n\n${mcpToolsDescription}\n\nIMPORTANT WORKFLOW FOR GETTING SONG LYRICS:\nWhen users ask for lyrics of a song, follow this workflow:\n1. If user provides song title (and optionally artist), use "get_song_by_title" tool - THIS IS THE BEST TOOL FOR LYRICS\n2. If you only have song ID, use "get_song_details" tool\n3. If you need to search first, use "search_songs" then use "get_song_details" with the song ID\n\nWHEN TO USE EACH TOOL (COMPREHENSIVE GUIDE):\n\nSONG TOOLS:\n- "get_song_by_title": BEST CHOICE when users ask for lyrics by song name. Returns full lyrics immediately.\n- "search_songs": Use to find songs when user provides partial information or keywords\n- "search_songs_advanced": Use when users want filtered results (e.g., "songs with lyrics", "my favorites", "songs with audio tracks")\n- "get_songs_by_artist": Use when users ask for all songs by a specific artist\n- "get_songs_by_album": Use when users ask for all songs from a specific album\n- "get_song_details": Use when you have a song ID. Returns COMPLETE song data including lyrics, tracks, scores, resources with URLs\n- "get_song_resources": Use to get tracks, scores, and links. Returns FULL URLs and paths for all resources\n- "get_song_access_control": Use when users ask about song permissions, access control, or who can access a song\n- "get_song_state": Use when users ask about playback state, active tracks, or track volumes for a song\n- "find_similar_songs": Use when users want songs similar to a specific song\n- "search_songs_by_theme": Use to find songs matching a theme or topic in lyrics\n- "search_with_suggestions": Use when search returns no results - provides helpful suggestions\n\nPLAYLIST TOOLS:\n- "get_playlists": Use to get all playlists for the user (summary list)\n- "get_playlist_details": Use to get detailed information about a specific playlist including all songs with positions and notes\n\nGROUP TOOLS:\n- "get_user_groups": Use to get all groups the user belongs to (summary list)\n- "get_group_details": Use to get detailed information about a specific group including all members\n\nUSER TOOLS:\n- "get_user_info": Use when users ask about their profile, stats, preferences, or activity\n- "get_favorite_songs": Use when users ask for their favorite songs\n- "get_all_user_data": Use when users want comprehensive information about everything - returns profile, stats, favorites, playlists, groups, library stats, and song/track states\n\nTRACK TOOLS:\n- "get_track_states": Use when users ask about individual track states (solo, mute, volume) for tracks in a song\n\nANALYTICS TOOLS:\n- "get_library_statistics": Use when users ask about library stats, counts, or want to see what's available\n\nCRITICAL: When users ask "show me lyrics of [song name]" or "what are the lyrics of [song]", you MUST use "get_song_by_title" tool with the song title. Do not try to answer from memory or summary - always use the tool to get the actual lyrics.\n\nREMEMBER: You have access to EVERYTHING in the project. If a user asks about any data, there is a tool to access it. Use the appropriate tool to get the information.\n\nEMBEDDING MEDIA IN RESPONSES:\nWhen you provide information about songs that includes scores (PDFs) or tracks (audio files), you can embed them directly in your response so they render in the chat interface.\n\nTo embed media, include a JSON code block with the score/track data:\n\nFor scores:\n\`\`\`json\n{\n  "scores": [\n    {\n      "url": "https://...",\n      "name": "Score Name",\n      "pages": ["url1", "url2"] // optional, for multi-page PDFs\n    }\n  ]\n}\n\`\`\`\n\nFor tracks:\n\`\`\`json\n{\n  "tracks": [\n    {\n      "path": "audio/path/to/file.mp3",\n      "name": "Track Name"\n    }\n  ]\n}\n\`\`\`\n\nFor resources (videos, links, downloads, etc.):\n\`\`\`json\n{\n  "resources": [\n    {\n      "url": "https://...",\n      "name": "Resource Name",\n      "type": "youtube", // or "audio", "download", "link", "pdf"\n      "description": "Optional description"\n    }\n  ]\n}\n\`\`\`\n\nYou can include scores, tracks, and resources in the same JSON block. The chat interface will automatically render:\n- PDF viewers for scores\n- Audio players for tracks\n- YouTube video players for youtube resources\n- PDF viewers for pdf resources\n- Audio players for audio resources\n- Clickable links for download and link resources\n\nExample: When a user asks "show me the score for [song name]" or "show me the video for [song name]", use get_song_details or get_song_by_title, then include the score/resource data in a JSON code block in your response.\n\nThe summary below provides an overview, but for detailed queries, always use the MCP tools.\n\n=== END OF MCP TOOLS ===\n\n`;
      }

      systemPrompt += `\n=== ${enableMCP ? 'LIBRARY SUMMARY' : 'COMPLETE DATABASE CONTEXT'} ===\n\n${contextData}\n\n=== END OF ${enableMCP ? 'SUMMARY' : 'DATABASE CONTEXT'} ===\n\n${enableMCP ? 'Remember: Use MCP tools to query detailed information when users ask specific questions. The summary above is just an overview.' : 'Remember: You have access to the complete database context above. Use this full information to answer the user\'s questions accurately and comprehensively.'}`;

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

      // Call AI API based on provider (with MCP tool support if enabled)
      const response = await this.callAIAPIWithMCP(messages);
      console.log('AI response received, length:', typeof response === 'string' ? response.length : 'N/A');
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
   * Call AI API with MCP tool support (handles function calling)
   */
  private async callAIAPIWithMCP(messages: Array<{ role: string; content: string }>): Promise<string> {
    const enableMCP = this.config.enableMCP !== false;
    const maxToolCalls = 5; // Limit tool calls to prevent infinite loops
    let toolCallCount = 0;

    while (toolCallCount < maxToolCalls) {
      const { provider, apiKey, model, baseURL } = this.config;
      let response: any;

      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(messages, apiKey!, model!, baseURL, enableMCP);
          break;
        case 'anthropic':
          response = await this.callAnthropic(messages, apiKey!, model!, enableMCP);
          break;
        case 'google':
          response = await this.callGoogle(messages, apiKey!, model!, enableMCP);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      // Check if response contains tool calls
      if (response.toolCalls && response.toolCalls.length > 0 && enableMCP) {
        toolCallCount++;
        console.log(`Executing ${response.toolCalls.length} MCP tool call(s)...`);

        // Execute all tool calls
        const toolResults = await Promise.all(
          response.toolCalls.map(async (toolCall: any) => {
            try {
              // Parse arguments - handle both string and object formats
              let args: any = {};
              if (toolCall.function?.arguments) {
                args = typeof toolCall.function.arguments === 'string' 
                  ? JSON.parse(toolCall.function.arguments) 
                  : toolCall.function.arguments;
              } else if (toolCall.arguments) {
                args = typeof toolCall.arguments === 'string' 
                  ? JSON.parse(toolCall.arguments) 
                  : toolCall.arguments;
              }

              const mcpToolCall: MCPToolCall = {
                name: toolCall.function?.name || toolCall.name,
                arguments: args
              };
              const result = await this.mcpClient.callTool(mcpToolCall);
              return {
                tool_call_id: toolCall.id || toolCall.tool_call_id,
                role: 'tool' as const,
                name: mcpToolCall.name,
                content: result.content[0]?.text || JSON.stringify(result.content)
              };
            } catch (error: any) {
              return {
                tool_call_id: toolCall.id || toolCall.tool_call_id,
                role: 'tool' as const,
                name: toolCall.function?.name || toolCall.name,
                content: `Error: ${error.message}`
              };
            }
          })
        );

        // Add assistant message with tool calls (if any) and tool results
        // For Anthropic, we need to preserve tool_use blocks in the assistant message
        const assistantMessage: any = {
          role: 'assistant',
          content: response.content || response.text || ''
        };
        
        // Store tool call IDs for reference (needed for Anthropic)
        if (response.toolCalls && response.toolCalls.length > 0) {
          assistantMessage.toolCalls = response.toolCalls;
          // Store Anthropic content if available (includes tool_use blocks)
          if (response.anthropicContent) {
            assistantMessage.anthropicContent = response.anthropicContent;
          }
        }
        
        messages.push(assistantMessage);
        toolResults.forEach(result => {
          messages.push(result);
        });

        // Continue the conversation with tool results
        continue;
      }

      // No tool calls, return the final response
      return response.content || response.text || response;
    }

    // If we've made too many tool calls, return the last response
    console.warn(`Reached maximum tool call limit (${maxToolCalls}), returning last response`);
    return messages[messages.length - 1]?.content || 'Maximum tool call limit reached';
  }

  /**
   * Call AI API based on configured provider (legacy method, kept for compatibility)
   */
  private async callAIAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
    return this.callAIAPIWithMCP(messages);
  }

  /**
   * Call OpenAI API with optional MCP tool support
   */
  private async callOpenAI(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string,
    baseURL?: string,
    enableMCP: boolean = false
  ): Promise<any> {
    const url = baseURL || 'https://api.openai.com/v1/chat/completions';
    
    // Get MCP tools if enabled
    const tools = enableMCP ? this.mcpClient.getTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    })) : undefined;

    const requestBody: any = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

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
        choiceCount: data.choices?.length || 0,
        hasToolCalls: !!data.choices[0]?.message?.tool_calls
      });

      const message = data.choices[0]?.message;
      if (message.tool_calls && message.tool_calls.length > 0) {
        return {
          content: message.content || '',
          toolCalls: message.tool_calls.map((tc: any) => ({
            id: tc.id,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }))
        };
      }

      return {
        content: message?.content || 'No response from AI',
        text: message?.content || 'No response from AI'
      };
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
   * Call Anthropic Claude API with optional MCP tool support
   */
  private async callAnthropic(
    messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>,
    apiKey: string,
    model: string,
    enableMCP: boolean = false
  ): Promise<any> {
    // Filter out system message and convert format for Anthropic
    // Handle tool messages (role: 'tool') specially
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        if (msg.role === 'tool') {
          // Tool result message
          return {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: (msg as any).tool_call_id,
              content: msg.content
            }]
          };
        } else if (msg.role === 'assistant') {
          // Check if assistant message has tool calls embedded (from previous Anthropic response)
          if ((msg as any).anthropicContent) {
            // Use the full content including tool_use blocks
            return {
              role: 'assistant' as const,
              content: (msg as any).anthropicContent
            };
          }
          return {
            role: 'assistant' as const,
            content: [{ type: 'text', text: msg.content }]
          };
        } else {
          return {
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: [{ type: 'text', text: msg.content }]
          };
        }
      });

    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

    // Get MCP tools if enabled
    const tools = enableMCP ? this.mcpClient.getTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    })) : undefined;

    const requestBody: any = {
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemMessage,
      messages: anthropicMessages
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Anthropic API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    
    // Check for tool use
    const toolUseBlocks = data.content.filter((block: any) => block.type === 'tool_use');
    if (toolUseBlocks.length > 0) {
      // For Anthropic, we need to preserve the full content including tool_use blocks
      return {
        content: data.content.find((block: any) => block.type === 'text')?.text || '',
        text: data.content.find((block: any) => block.type === 'text')?.text || '',
        toolCalls: toolUseBlocks.map((block: any) => ({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input)
        })),
        // Store full content for Anthropic (includes tool_use blocks)
        anthropicContent: data.content
      };
    }

    return {
      content: data.content[0]?.text || 'No response from AI',
      text: data.content[0]?.text || 'No response from AI'
    };
  }

  /**
   * Call Google Gemini API with optional MCP tool support
   */
  private async callGoogle(
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    model: string,
    enableMCP: boolean = false
  ): Promise<any> {
    // Convert messages to Gemini format
    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    const systemInstruction = messages.find(msg => msg.role === 'system')?.content || '';

    // Get MCP tools if enabled (Gemini uses FunctionDeclaration format)
    const tools = enableMCP ? [{
      functionDeclarations: this.mcpClient.getTools().map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || []
        }
      }))
    }] : undefined;

    const requestBody: any = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Google API error: ${error.error?.message || JSON.stringify(error)}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    
    // Check for function calls
    const functionCalls = candidate?.content?.parts?.filter((part: any) => part.functionCall);
    if (functionCalls && functionCalls.length > 0) {
      return {
        content: candidate.content.parts.find((part: any) => part.text)?.text || '',
        toolCalls: functionCalls.map((part: any) => ({
          id: part.functionCall.name,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {})
        }))
      };
    }

    return {
      content: candidate?.content?.parts?.[0]?.text || 'No response from AI',
      text: candidate?.content?.parts?.[0]?.text || 'No response from AI'
    };
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

