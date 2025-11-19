/**
 * Parser utility to extract embedded media (scores, tracks, and resources) from AI chat responses
 */

export interface EmbeddedScore {
  type: 'score';
  url: string;
  name: string;
  pages?: string[];
}

export interface EmbeddedTrack {
  type: 'track';
  path: string;
  name: string;
}

export interface EmbeddedResource {
  type: 'resource';
  url: string;
  name: string;
  resourceType: 'youtube' | 'audio' | 'download' | 'link' | 'pdf';
  description?: string;
}

export type EmbeddedMedia = EmbeddedScore | EmbeddedTrack | EmbeddedResource;

export interface ParsedMessage {
  textParts: string[];
  media: EmbeddedMedia[];
}

/**
 * Parse AI response to extract embedded media and text parts
 * Supports:
 * 1. JSON code blocks containing score/track data
 * 2. Special markdown tags: [EMBED_SCORE:url:name] or [EMBED_TRACK:path:name]
 */
export function parseChatMessage(content: string): ParsedMessage {
  const media: EmbeddedMedia[] = [];
  const textParts: string[] = [];
  
  let remainingText = content;
  
  // First, try to extract JSON code blocks with score/track data
  const jsonBlockRegex = /```json\n([\s\S]*?)```/g;
  let jsonMatch;
  let lastIndex = 0;
  
  while ((jsonMatch = jsonBlockRegex.exec(content)) !== null) {
    const beforeJson = content.substring(lastIndex, jsonMatch.index);
    if (beforeJson.trim()) {
      textParts.push(beforeJson);
    }
    
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      
      // Extract scores
      if (jsonData.scores && Array.isArray(jsonData.scores)) {
        jsonData.scores.forEach((score: any) => {
          if (score.url || (score.pages && score.pages.length > 0)) {
            media.push({
              type: 'score',
              url: score.url || score.pages[0],
              name: score.name || 'Score',
              pages: score.pages || (score.url ? [score.url] : undefined)
            });
          }
        });
      }
      
      // Extract tracks
      if (jsonData.tracks && Array.isArray(jsonData.tracks)) {
        jsonData.tracks.forEach((track: any) => {
          if (track.path) {
            media.push({
              type: 'track',
              path: track.path,
              name: track.name || 'Track'
            });
          }
        });
      }
      
      // Extract resources
      if (jsonData.resources && Array.isArray(jsonData.resources)) {
        jsonData.resources.forEach((resource: any) => {
          if (resource.url) {
            media.push({
              type: 'resource',
              url: resource.url,
              name: resource.name || 'Resource',
              resourceType: resource.type || 'link',
              description: resource.description
            });
          }
        });
      }
      
      // If the JSON contains a single score, track, or resource at root level
      if (jsonData.url && (jsonData.type === 'score' || (jsonData.name && !jsonData.type))) {
        media.push({
          type: 'score',
          url: jsonData.url,
          name: jsonData.name || 'Score',
          pages: jsonData.pages || [jsonData.url]
        });
      }
      
      if (jsonData.path && jsonData.type === 'track') {
        media.push({
          type: 'track',
          path: jsonData.path,
          name: jsonData.name || 'Track'
        });
      }
      
      if (jsonData.url && jsonData.type === 'resource') {
        media.push({
          type: 'resource',
          url: jsonData.url,
          name: jsonData.name || 'Resource',
          resourceType: jsonData.resourceType || 'link',
          description: jsonData.description
        });
      }
    } catch (error) {
      // If JSON parsing fails, treat it as regular text
      textParts.push(jsonMatch[0]);
    }
    
    lastIndex = jsonMatch.index + jsonMatch[0].length;
  }
  
  // Add remaining text after last JSON block
  if (lastIndex < content.length) {
    const afterJson = content.substring(lastIndex);
    if (afterJson.trim()) {
      textParts.push(afterJson);
    }
  }
  
  // If no JSON blocks found, try parsing special markdown tags
  if (media.length === 0 && textParts.length === 0) {
    const embedScoreRegex = /\[EMBED_SCORE:([^:]+):([^\]]+)\]/g;
    const embedTrackRegex = /\[EMBED_TRACK:([^:]+):([^\]]+)\]/g;
    
    let scoreMatch;
    let trackMatch;
    let currentIndex = 0;
    const parts: Array<{ type: 'text' | 'score' | 'track'; content: string; data?: any }> = [];
    
    // Find all embedded media tags
    const allMatches: Array<{ index: number; length: number; type: 'score' | 'track'; data: any }> = [];
    
    // Reset regex
    embedScoreRegex.lastIndex = 0;
    embedTrackRegex.lastIndex = 0;
    
    while ((scoreMatch = embedScoreRegex.exec(content)) !== null) {
      allMatches.push({
        index: scoreMatch.index,
        length: scoreMatch[0].length,
        type: 'score',
        data: {
          url: scoreMatch[1],
          name: scoreMatch[2]
        }
      });
    }
    
    while ((trackMatch = embedTrackRegex.exec(content)) !== null) {
      allMatches.push({
        index: trackMatch.index,
        length: trackMatch[0].length,
        type: 'track',
        data: {
          path: trackMatch[1],
          name: trackMatch[2]
        }
      });
    }
    
    // Sort matches by index
    allMatches.sort((a, b) => a.index - b.index);
    
    // Build parts array
    allMatches.forEach((match, idx) => {
      // Add text before match
      if (match.index > currentIndex) {
        const textPart = content.substring(currentIndex, match.index);
        if (textPart.trim()) {
          parts.push({ type: 'text', content: textPart });
        }
      }
      
      // Add media
      if (match.type === 'score') {
        media.push({
          type: 'score',
          url: match.data.url,
          name: match.data.name,
          pages: [match.data.url]
        });
      } else {
        media.push({
          type: 'track',
          path: match.data.path,
          name: match.data.name
        });
      }
      
      currentIndex = match.index + match.length;
    });
    
    // Add remaining text
    if (currentIndex < content.length) {
      const remaining = content.substring(currentIndex);
      if (remaining.trim()) {
        parts.push({ type: 'text', content: remaining });
      }
    }
    
    // Extract text parts
    textParts.push(...parts.filter(p => p.type === 'text').map(p => p.content));
  }
  
  // If still no media found, return original content as single text part
  if (textParts.length === 0 && media.length === 0) {
    textParts.push(content);
  }
  
  return {
    textParts: textParts.length > 0 ? textParts : [content],
    media
  };
}

/**
 * Check if a URL is likely a PDF
 */
export function isPDFUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
}

/**
 * Check if a path/URL is likely an audio file
 */
export function isAudioPath(path: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
  const lowerPath = path.toLowerCase();
  return audioExtensions.some(ext => lowerPath.endsWith(ext));
}

