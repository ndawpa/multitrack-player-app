/**
 * MCP (Model Context Protocol) Client Service
 * Implements MCP client to interact with MCP servers and provide tools/resources to AI models
 */

import { ref, get } from 'firebase/database';
import { database } from '../config/firebase';
import { Song } from '../types/song';
import { Playlist } from '../types/playlist';
import { UserGroup } from '../types/group';
import AuthService from './authService';
import SongAccessService from './songAccessService';
import PlaylistService from './playlistService';
import GroupService from './groupService';
import FavoritesService from './favoritesService';
import SongStateService from './songStateService';
import TrackStateService from './trackStateService';

// MCP Protocol Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP Client Service
 * Provides tools and resources for AI models to interact with the music library
 */
class MCPClientService {
  private static instance: MCPClientService;
  private authService: AuthService;
  private songAccessService: SongAccessService;
  private playlistService: PlaylistService;
  private groupService: GroupService;
  private favoritesService: FavoritesService;
  private songStateService: SongStateService;
  private trackStateService: TrackStateService;

  // Available MCP Tools
  private tools: MCPTool[] = [
    {
      name: 'search_songs',
      description: 'Search for songs in the music library by title, artist, album, or lyrics content. Returns matching songs with their metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find songs (searches in title, artist, album, and lyrics)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20)',
            default: 20
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_song_details',
      description: 'Get detailed information about a specific song including FULL LYRICS, metadata, tracks, scores, and resources. Use this when you have the song ID.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to retrieve (get this from search_songs results)'
          }
        },
        required: ['songId']
      }
    },
    {
      name: 'get_song_by_title',
      description: 'Get detailed information about a song by its title and artist, including FULL LYRICS. This is the BEST tool to use when users ask for lyrics of a specific song. Returns complete song information including full lyrics text.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The title of the song (required)'
          },
          artist: {
            type: 'string',
            description: 'The artist name (optional, but recommended for better matching)'
          }
        },
        required: ['title']
      }
    },
    {
      name: 'get_playlists',
      description: 'Get all playlists for the current user, including their songs and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          includeSongs: {
            type: 'boolean',
            description: 'Whether to include song details in playlists (default: true)',
            default: true
          }
        }
      }
    },
    {
      name: 'get_user_groups',
      description: 'Get all groups the current user belongs to, including group metadata and member information.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'search_songs_by_theme',
      description: 'Search for songs that match a specific theme, topic, or mood based on lyrics content.',
      inputSchema: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            description: 'The theme, topic, or mood to search for in song lyrics'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20)',
            default: 20
          }
        },
        required: ['theme']
      }
    },
    {
      name: 'get_song_resources',
      description: 'Get all available resources (tracks, scores, links) for a specific song. Returns FULL URLs and paths for: audio tracks (path field), PDF scores (url or pages array), and external resources (url field). Use this when users ask for download links, audio file locations, or score PDFs.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to get resources for'
          }
        },
        required: ['songId']
      }
    },
    {
      name: 'search_songs_advanced',
      description: 'Advanced search with multiple filters. Use this when users want to find songs by specific criteria like "songs with lyrics", "my favorites", "songs with audio tracks", etc. Supports combining multiple filters.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional text search query (searches in title, artist, album, lyrics)'
          },
          artist: {
            type: 'string',
            description: 'Filter by specific artist name'
          },
          album: {
            type: 'string',
            description: 'Filter by specific album name'
          },
          hasLyrics: {
            type: 'boolean',
            description: 'Only return songs that have lyrics'
          },
          hasTracks: {
            type: 'boolean',
            description: 'Only return songs that have audio tracks'
          },
          hasScores: {
            type: 'boolean',
            description: 'Only return songs that have scores/PDFs'
          },
          hasResources: {
            type: 'boolean',
            description: 'Only return songs that have external resources/links'
          },
          favoritesOnly: {
            type: 'boolean',
            description: 'Only return songs that are in user\'s favorites'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 50)',
            default: 50
          }
        }
      }
    },
    {
      name: 'get_songs_by_artist',
      description: 'Get all songs by a specific artist. Returns complete list of songs including metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          artist: {
            type: 'string',
            description: 'The artist name to search for'
          },
          includeLyrics: {
            type: 'boolean',
            description: 'Whether to include full lyrics in response (default: false, set to true only if needed)',
            default: false
          }
        },
        required: ['artist']
      }
    },
    {
      name: 'get_songs_by_album',
      description: 'Get all songs from a specific album.',
      inputSchema: {
        type: 'object',
        properties: {
          album: {
            type: 'string',
            description: 'The album name to search for'
          }
        },
        required: ['album']
      }
    },
    {
      name: 'get_favorite_songs',
      description: 'Get all songs that the user has marked as favorites.',
      inputSchema: {
        type: 'object',
        properties: {
          includeLyrics: {
            type: 'boolean',
            description: 'Whether to include full lyrics (default: false)',
            default: false
          }
        }
      }
    },
    {
      name: 'get_library_statistics',
      description: 'Get comprehensive statistics about the user\'s music library including counts, artists, albums, and content availability.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'find_similar_songs',
      description: 'Find songs similar to a given song. Can find by same artist, same album, or similar themes in lyrics.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to find similar songs for'
          },
          songTitle: {
            type: 'string',
            description: 'Alternative: The title of the song (if you don\'t have the ID)'
          },
          byArtist: {
            type: 'boolean',
            description: 'Find songs by the same artist (default: true)',
            default: true
          },
          byAlbum: {
            type: 'boolean',
            description: 'Find songs from the same album (default: true)',
            default: true
          },
          byTheme: {
            type: 'boolean',
            description: 'Find songs with similar themes in lyrics (default: false)',
            default: false
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)',
            default: 20
          }
        }
      }
    },
    {
      name: 'search_with_suggestions',
      description: 'Search for songs and if no exact matches found, return suggestions for similar songs or common search terms. Helps when user\'s query doesn\'t match exactly.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20)',
            default: 20
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_user_info',
      description: 'Get current user\'s complete profile information including stats, preferences, favorites, and activity data.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_playlist_details',
      description: 'Get detailed information about a specific playlist including all songs with their positions, notes, and full metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          playlistId: {
            type: 'string',
            description: 'The ID of the playlist to retrieve'
          },
          includeSongDetails: {
            type: 'boolean',
            description: 'Whether to include full song details for each playlist item (default: false)',
            default: false
          }
        },
        required: ['playlistId']
      }
    },
    {
      name: 'get_group_details',
      description: 'Get detailed information about a specific group including all members, permissions, and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          groupId: {
            type: 'string',
            description: 'The ID of the group to retrieve'
          },
          includeMembers: {
            type: 'boolean',
            description: 'Whether to include member details (default: true)',
            default: true
          }
        },
        required: ['groupId']
      }
    },
    {
      name: 'get_song_access_control',
      description: 'Get access control information for a specific song including visibility, allowed users, allowed groups, and access levels.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to get access control for'
          }
        },
        required: ['songId']
      }
    },
    {
      name: 'get_song_state',
      description: 'Get playback state for a specific song including active tracks, soloed tracks, and track volumes.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to get state for'
          }
        },
        required: ['songId']
      }
    },
    {
      name: 'get_track_states',
      description: 'Get individual track states (solo, mute, volume) for all tracks in a specific song.',
      inputSchema: {
        type: 'object',
        properties: {
          songId: {
            type: 'string',
            description: 'The ID of the song to get track states for'
          }
        },
        required: ['songId']
      }
    },
    {
      name: 'get_all_user_data',
      description: 'Get comprehensive user data including profile, stats, preferences, favorites, playlists, groups, and song states. Returns everything about the current user.',
      inputSchema: {
        type: 'object',
        properties: {
          includeSongStates: {
            type: 'boolean',
            description: 'Whether to include song and track states (default: true)',
            default: true
          }
        }
      }
    }
  ];

  private constructor() {
    this.authService = AuthService.getInstance();
    this.songAccessService = SongAccessService.getInstance();
    this.playlistService = PlaylistService.getInstance();
    this.groupService = GroupService.getInstance();
    this.favoritesService = FavoritesService.getInstance();
    this.songStateService = SongStateService.getInstance();
    this.trackStateService = TrackStateService.getInstance();
  }

  public static getInstance(): MCPClientService {
    if (!MCPClientService.instance) {
      MCPClientService.instance = new MCPClientService();
    }
    return MCPClientService.instance;
  }

  /**
   * Get list of available MCP tools
   */
  public getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Get tool by name
   */
  public getTool(name: string): MCPTool | undefined {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * Execute an MCP tool call
   */
  public async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    const tool = this.getTool(toolCall.name);
    if (!tool) {
      return {
        content: [{
          type: 'text',
          text: `Error: Tool "${toolCall.name}" not found. Available tools: ${this.tools.map(t => t.name).join(', ')}`
        }],
        isError: true
      };
    }

    try {
      switch (toolCall.name) {
        case 'search_songs':
          return await this.searchSongs(toolCall.arguments);
        case 'get_song_details':
          return await this.getSongDetails(toolCall.arguments);
        case 'get_song_by_title':
          return await this.getSongByTitle(toolCall.arguments);
        case 'get_playlists':
          return await this.getPlaylists(toolCall.arguments);
        case 'get_user_groups':
          return await this.getUserGroups(toolCall.arguments);
        case 'search_songs_by_theme':
          return await this.searchSongsByTheme(toolCall.arguments);
        case 'get_song_resources':
          return await this.getSongResources(toolCall.arguments);
        case 'search_songs_advanced':
          return await this.searchSongsAdvanced(toolCall.arguments);
        case 'get_songs_by_artist':
          return await this.getSongsByArtist(toolCall.arguments);
        case 'get_songs_by_album':
          return await this.getSongsByAlbum(toolCall.arguments);
        case 'get_favorite_songs':
          return await this.getFavoriteSongs(toolCall.arguments);
        case 'get_library_statistics':
          return await this.getLibraryStatistics(toolCall.arguments);
        case 'find_similar_songs':
          return await this.findSimilarSongs(toolCall.arguments);
        case 'search_with_suggestions':
          return await this.searchWithSuggestions(toolCall.arguments);
        case 'get_user_info':
          return await this.getUserInfo(toolCall.arguments);
        case 'get_playlist_details':
          return await this.getPlaylistDetails(toolCall.arguments);
        case 'get_group_details':
          return await this.getGroupDetails(toolCall.arguments);
        case 'get_song_access_control':
          return await this.getSongAccessControl(toolCall.arguments);
        case 'get_song_state':
          return await this.getSongState(toolCall.arguments);
        case 'get_track_states':
          return await this.getTrackStates(toolCall.arguments);
        case 'get_all_user_data':
          return await this.getAllUserData(toolCall.arguments);
        default:
          return {
            content: [{
              type: 'text',
              text: `Error: Tool "${toolCall.name}" is not implemented`
            }],
            isError: true
          };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error executing tool "${toolCall.name}": ${error.message || String(error)}`
        }],
        isError: true
      };
    }
  }

  /**
   * Search songs tool implementation
   */
  private async searchSongs(args: { query: string; limit?: number }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    const limit = args.limit || 20;
    const query = args.query.toLowerCase();

    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ songs: [], count: 0 }, null, 2)
          }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const matchingSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        // Search in title, artist, album, lyrics
        const title = (songDataTyped.title || '').toLowerCase();
        const artist = (songDataTyped.artist || '').toLowerCase();
        const album = (songDataTyped.album || '').toLowerCase();
        const lyrics = (songDataTyped.lyrics || '').toLowerCase();

        if (title.includes(query) || artist.includes(query) || 
            album.includes(query) || lyrics.includes(query)) {
          matchingSongs.push({
            id: songId,
            ...songDataTyped
          } as Song);
        }

        if (matchingSongs.length >= limit) break;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songs: matchingSongs.map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              hasLyrics: !!song.lyrics,
              lyricsPreview: song.lyrics ? (song.lyrics.substring(0, 200) + (song.lyrics.length > 200 ? '...' : '')) : null,
              tracksCount: song.tracks?.length || 0,
              scoresCount: song.scores?.length || 0,
              resourcesCount: song.resources?.length || 0
            })),
            count: matchingSongs.length,
            query: args.query,
            note: 'Use get_song_details with song ID or get_song_by_title with title to get full lyrics'
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error searching songs: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get song details tool implementation
   */
  private async getSongDetails(args: { songId: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    try {
      const songRef = ref(database, `songs/${args.songId}`);
      const snapshot = await get(songRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: `Error: Song with ID "${args.songId}" not found`
          }],
          isError: true
        };
      }

      const songData = snapshot.val() as any;
      const song: Song = {
        id: args.songId,
        ...songData
      };

      // Check access
      const hasAccess = await this.songAccessService.checkSongAccess(args.songId, user.id);
      if (!hasAccess) {
        return {
          content: [{
            type: 'text',
            text: `Error: Access denied to song "${args.songId}"`
          }],
          isError: true
        };
      }

      // Format response with lyrics prominently displayed
      const responseData: any = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album || null,
        lyrics: song.lyrics || null,
        hasLyrics: !!song.lyrics,
        lyricsLength: song.lyrics ? song.lyrics.length : 0,
        tracks: (song.tracks || []).map(track => ({
          id: track.id,
          name: track.name,
          path: track.path, // Full path/URL to audio file
          note: 'This path can be used to access the audio track'
        })),
        scores: (song.scores || []).map(score => ({
          id: score.id,
          name: score.name,
          url: score.url, // URL for single-page score
          pages: score.pages || [], // Array of URLs for multi-page scores
          note: score.url ? 'Single PDF URL available' : score.pages?.length ? `${score.pages.length} page URLs available` : 'No URL available'
        })),
        resources: (song.resources || []).map(resource => ({
          id: resource.id,
          name: resource.name,
          type: resource.type, // youtube, audio, download, link, pdf
          url: resource.url, // Full URL to external resource
          description: resource.description,
          note: 'This URL can be used to access the external resource'
        })),
        tracksCount: song.tracks?.length || 0,
        scoresCount: song.scores?.length || 0,
        resourcesCount: song.resources?.length || 0,
        note: 'All tracks, scores, and resources include full URLs/paths that can be used to access the files'
      };

      // If lyrics exist, add a formatted version for easy reading
      if (song.lyrics) {
        responseData.lyricsFormatted = song.lyrics;
        responseData.note = 'Full lyrics are available in the "lyrics" field above';
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(responseData, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting song details: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get song by title tool implementation
   * This is the preferred method when users ask for lyrics by song name
   */
  private async getSongByTitle(args: { title: string; artist?: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'No songs found in database', song: null }, null, 2)
          }],
          isError: true
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const titleLower = args.title.toLowerCase();
      const artistLower = args.artist?.toLowerCase() || '';

      // Find matching song
      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        // Match by title (and artist if provided)
        const songTitle = (songDataTyped.title || '').toLowerCase();
        const songArtist = (songDataTyped.artist || '').toLowerCase();
        
        const titleMatches = songTitle === titleLower || songTitle.includes(titleLower) || titleLower.includes(songTitle);
        const artistMatches = !artistLower || songArtist === artistLower || songArtist.includes(artistLower) || artistLower.includes(songArtist);
        
        if (titleMatches && (!args.artist || artistMatches)) {
          // Found matching song, return full details including lyrics
          const song: Song = {
            id: songId,
            ...songDataTyped
          };

          // Format response with lyrics prominently displayed
          const responseData: any = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album || null,
            lyrics: song.lyrics || null,
            hasLyrics: !!song.lyrics,
            lyricsLength: song.lyrics ? song.lyrics.length : 0,
            tracks: (song.tracks || []).map(track => ({
              id: track.id,
              name: track.name,
              path: track.path, // Full path/URL to audio file
              note: 'This path can be used to access the audio track'
            })),
            scores: (song.scores || []).map(score => ({
              id: score.id,
              name: score.name,
              url: score.url, // URL for single-page score
              pages: score.pages || [], // Array of URLs for multi-page scores
              note: score.url ? 'Single PDF URL available' : score.pages?.length ? `${score.pages.length} page URLs available` : 'No URL available'
            })),
            resources: (song.resources || []).map(resource => ({
              id: resource.id,
              name: resource.name,
              type: resource.type, // youtube, audio, download, link, pdf
              url: resource.url, // Full URL to external resource
              description: resource.description,
              note: 'This URL can be used to access the external resource'
            })),
            tracksCount: song.tracks?.length || 0,
            scoresCount: song.scores?.length || 0,
            resourcesCount: song.resources?.length || 0,
            note: 'All tracks, scores, and resources include full URLs/paths that can be used to access the files'
          };

          // If lyrics exist, add a formatted version for easy reading
          if (song.lyrics) {
            responseData.lyricsFormatted = song.lyrics;
            responseData.note = 'Full lyrics are available in the "lyrics" field above';
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(responseData, null, 2)
            }]
          };
        }
      }

      // Song not found
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Song "${args.title}"${args.artist ? ` by ${args.artist}` : ''} not found in user's library`,
            song: null,
            suggestion: 'Try using search_songs to find similar songs'
          }, null, 2)
        }],
        isError: true
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting song by title: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get playlists tool implementation
   */
  private async getPlaylists(args: { includeSongs?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    try {
      const playlists = await this.playlistService.getUserPlaylists(user.id);
      const includeSongs = args.includeSongs !== false;

      const playlistsData = playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        isPublic: playlist.isPublic,
        playCount: playlist.playCount,
        lastPlayedAt: playlist.lastPlayedAt,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        songs: includeSongs ? (playlist.songs || []).map(item => ({
          songId: item.songId,
          songTitle: item.songTitle,
          songArtist: item.songArtist,
          position: item.position,
          notes: item.notes
        })) : undefined,
        songCount: playlist.songs?.length || 0
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            playlists: playlistsData,
            count: playlists.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting playlists: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get user groups tool implementation
   */
  private async getUserGroups(args: Record<string, any>): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    try {
      const groups = await this.groupService.getUserGroups(user.id);

      const groupsData = groups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        isAdmin: group.isAdmin,
        memberCount: group.members?.length || 0,
        createdAt: group.createdAt
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            groups: groupsData,
            count: groups.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting user groups: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Search songs by theme tool implementation
   */
  private async searchSongsByTheme(args: { theme: string; limit?: number }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    const limit = args.limit || 20;
    const theme = args.theme.toLowerCase();

    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ songs: [], count: 0 }, null, 2)
          }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const matchingSongs: Array<{ song: Song; relevanceScore: number }> = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        const lyrics = (songDataTyped.lyrics || '').toLowerCase();
        if (!lyrics) continue;

        // Calculate relevance score based on theme matches in lyrics
        const themeWords = theme.split(/\s+/);
        let relevanceScore = 0;
        
        themeWords.forEach(word => {
          const matches = (lyrics.match(new RegExp(word, 'g')) || []).length;
          relevanceScore += matches;
        });

        if (relevanceScore > 0) {
          matchingSongs.push({
            song: {
              id: songId,
              ...songDataTyped
            } as Song,
            relevanceScore
          });
        }
      }

      // Sort by relevance and limit
      matchingSongs.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const topMatches = matchingSongs.slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songs: topMatches.map(item => ({
              id: item.song.id,
              title: item.song.title,
              artist: item.song.artist,
              album: item.song.album,
              relevanceScore: item.relevanceScore,
              hasLyrics: !!item.song.lyrics
            })),
            count: topMatches.length,
            theme: args.theme
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error searching songs by theme: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get song resources tool implementation
   */
  private async getSongResources(args: { songId: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{
          type: 'text',
          text: 'Error: User not authenticated'
        }],
        isError: true
      };
    }

    try {
      const songRef = ref(database, `songs/${args.songId}`);
      const snapshot = await get(songRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: `Error: Song with ID "${args.songId}" not found`
          }],
          isError: true
        };
      }

      const songData = snapshot.val() as any;
      
      // Check access
      const hasAccess = await this.songAccessService.checkSongAccess(args.songId, user.id);
      if (!hasAccess) {
        return {
          content: [{
            type: 'text',
            text: `Error: Access denied to song "${args.songId}"`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songId: args.songId,
            title: songData.title,
            artist: songData.artist,
            tracks: (songData.tracks || []).map((track: any) => ({
              id: track.id,
              name: track.name,
              path: track.path, // Full path/URL to audio file - USE THIS to access the track
              note: 'This path contains the full URL/path to access the audio track'
            })),
            scores: (songData.scores || []).map((score: any) => ({
              id: score.id,
              name: score.name,
              url: score.url, // URL for single-page PDF score - USE THIS to access
              pages: score.pages || [], // Array of URLs for multi-page PDF scores - USE THESE to access
              note: score.url ? 'Single PDF URL available - use the "url" field' : score.pages?.length ? `${score.pages.length} page URLs available - use the "pages" array` : 'No URL available'
            })),
            resources: (songData.resources || []).map((resource: any) => ({
              id: resource.id,
              name: resource.name,
              type: resource.type, // youtube, audio, download, link, pdf
              url: resource.url, // Full URL to external resource - USE THIS to access
              description: resource.description,
              note: 'This URL can be used directly to access the external resource'
            })),
            tracksCount: (songData.tracks || []).length,
            scoresCount: (songData.scores || []).length,
            resourcesCount: (songData.resources || []).length,
            note: 'IMPORTANT: All tracks include "path" field with full URL/path. All scores include "url" or "pages" array with URLs. All resources include "url" field. These URLs/paths can be used directly to access the files.'
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error getting song resources: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Advanced search with filters implementation
   */
  private async searchSongsAdvanced(args: {
    query?: string;
    artist?: string;
    album?: string;
    hasLyrics?: boolean;
    hasTracks?: boolean;
    hasScores?: boolean;
    hasResources?: boolean;
    favoritesOnly?: boolean;
    limit?: number;
  }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const limit = args.limit || 50;
      const query = args.query?.toLowerCase() || '';
      const artistFilter = args.artist?.toLowerCase() || '';
      const albumFilter = args.album?.toLowerCase() || '';

      // Get favorites if needed
      let favoriteIds: string[] = [];
      if (args.favoritesOnly) {
        favoriteIds = await this.favoritesService.getFavoriteSongs();
      }

      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ songs: [], count: 0 }, null, 2) }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const matchingSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        // Apply filters
        if (args.favoritesOnly && !favoriteIds.includes(songId)) continue;
        if (args.hasLyrics && (!songDataTyped.lyrics || songDataTyped.lyrics.trim().length === 0)) continue;
        if (args.hasTracks && (!songDataTyped.tracks || songDataTyped.tracks.length === 0)) continue;
        if (args.hasScores && (!songDataTyped.scores || songDataTyped.scores.length === 0)) continue;
        if (args.hasResources && (!songDataTyped.resources || songDataTyped.resources.length === 0)) continue;

        const title = (songDataTyped.title || '').toLowerCase();
        const artist = (songDataTyped.artist || '').toLowerCase();
        const album = (songDataTyped.album || '').toLowerCase();
        const lyrics = (songDataTyped.lyrics || '').toLowerCase();

        // Apply text search
        if (query && !title.includes(query) && !artist.includes(query) && 
            !album.includes(query) && !lyrics.includes(query)) {
          continue;
        }

        // Apply artist filter
        if (artistFilter && !artist.includes(artistFilter) && !artistFilter.includes(artist)) {
          continue;
        }

        // Apply album filter
        if (albumFilter && !album.includes(albumFilter) && !albumFilter.includes(album)) {
          continue;
        }

        matchingSongs.push({
          id: songId,
          ...songDataTyped
        } as Song);

        if (matchingSongs.length >= limit) break;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songs: matchingSongs.map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              hasLyrics: !!song.lyrics,
              hasTracks: (song.tracks?.length || 0) > 0,
              hasScores: (song.scores?.length || 0) > 0,
              hasResources: (song.resources?.length || 0) > 0
            })),
            count: matchingSongs.length,
            filters: args
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error in advanced search: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get songs by artist implementation
   */
  private async getSongsByArtist(args: { artist: string; includeLyrics?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const artistLower = args.artist.toLowerCase();
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ songs: [], count: 0, artist: args.artist }, null, 2) }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const matchingSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        const songArtist = (songDataTyped.artist || '').toLowerCase();
        
        if (!songArtist.includes(artistLower) && !artistLower.includes(songArtist)) continue;

        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (hasAccess) {
          matchingSongs.push({
            id: songId,
            ...songDataTyped
          } as Song);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            artist: args.artist,
            songs: matchingSongs.map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              lyrics: args.includeLyrics ? song.lyrics : undefined,
              hasLyrics: !!song.lyrics,
              tracksCount: song.tracks?.length || 0,
              scoresCount: song.scores?.length || 0
            })),
            count: matchingSongs.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting songs by artist: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get songs by album implementation
   */
  private async getSongsByAlbum(args: { album: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const albumLower = args.album.toLowerCase();
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ songs: [], count: 0, album: args.album }, null, 2) }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const matchingSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        const songAlbum = (songDataTyped.album || '').toLowerCase();
        
        if (!songAlbum.includes(albumLower) && !albumLower.includes(songAlbum)) continue;

        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (hasAccess) {
          matchingSongs.push({
            id: songId,
            ...songDataTyped
          } as Song);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            album: args.album,
            songs: matchingSongs.map(song => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album
            })),
            count: matchingSongs.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting songs by album: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get favorite songs implementation
   */
  private async getFavoriteSongs(args: { includeLyrics?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const favoriteSongs = await this.favoritesService.getFavoriteSongsWithData();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            favorites: favoriteSongs.map((song: any) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              lyrics: args.includeLyrics ? song.lyrics : undefined,
              hasLyrics: !!song.lyrics,
              tracksCount: song.tracks?.length || 0,
              scoresCount: song.scores?.length || 0
            })),
            count: favoriteSongs.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting favorite songs: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get library statistics implementation
   */
  private async getLibraryStatistics(args: Record<string, any>): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ totalSongs: 0, artists: 0, albums: 0 }, null, 2) }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const artists = new Set<string>();
      const albums = new Set<string>();
      let totalSongs = 0;
      let songsWithLyrics = 0;
      let songsWithTracks = 0;
      let songsWithScores = 0;
      let songsWithResources = 0;
      const favoriteIds = await this.favoritesService.getFavoriteSongs();

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        totalSongs++;
        if (songDataTyped.artist) artists.add(songDataTyped.artist);
        if (songDataTyped.album) albums.add(songDataTyped.album);
        if (songDataTyped.lyrics && songDataTyped.lyrics.trim().length > 0) songsWithLyrics++;
        if (songDataTyped.tracks && songDataTyped.tracks.length > 0) songsWithTracks++;
        if (songDataTyped.scores && songDataTyped.scores.length > 0) songsWithScores++;
        if (songDataTyped.resources && songDataTyped.resources.length > 0) songsWithResources++;
      }

      const playlists = await this.playlistService.getUserPlaylists(user.id);
      const groups = await this.groupService.getUserGroups(user.id);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalSongs,
            uniqueArtists: artists.size,
            uniqueAlbums: albums.size,
            songsWithLyrics,
            songsWithTracks,
            songsWithScores,
            songsWithResources,
            favoriteSongs: favoriteIds.length,
            totalPlaylists: playlists.length,
            totalGroups: groups.length,
            topArtists: Array.from(artists).slice(0, 10)
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting library statistics: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Find similar songs implementation
   */
  private async findSimilarSongs(args: {
    songId?: string;
    songTitle?: string;
    byArtist?: boolean;
    byAlbum?: boolean;
    byTheme?: boolean;
    limit?: number;
  }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      let targetSong: Song | null = null;

      // Find target song
      if (args.songId) {
        const songRef = ref(database, `songs/${args.songId}`);
        const snapshot = await get(songRef);
        if (snapshot.exists()) {
          targetSong = { id: args.songId, ...snapshot.val() } as Song;
        }
      } else if (args.songTitle) {
        // Use getSongByTitle logic
        const songsRef = ref(database, 'songs');
        const snapshot = await get(songsRef);
        if (snapshot.exists()) {
          const allSongs = snapshot.val();
          for (const [songId, songData] of Object.entries(allSongs)) {
            const songDataTyped = songData as any;
            const title = (songDataTyped.title || '').toLowerCase();
            if (title.includes(args.songTitle!.toLowerCase())) {
              targetSong = { id: songId, ...songDataTyped } as Song;
              break;
            }
          }
        }
      }

      if (!targetSong) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Target song not found', similarSongs: [] }, null, 2) }],
          isError: true
        };
      }

      const limit = args.limit || 20;
      const byArtist = args.byArtist !== false;
      const byAlbum = args.byAlbum !== false;
      const byTheme = args.byTheme === true;

      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ similarSongs: [], count: 0 }, null, 2) }]
        };
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const similarSongs: Array<{ song: Song; similarityScore: number }> = [];
      const targetArtist = (targetSong.artist || '').toLowerCase();
      const targetAlbum = (targetSong.album || '').toLowerCase();
      const targetLyrics = (targetSong.lyrics || '').toLowerCase();

      for (const [songId, songData] of songEntries) {
        if (songId === targetSong.id) continue; // Skip the target song itself

        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (!hasAccess) continue;

        let similarityScore = 0;
        const songArtist = (songDataTyped.artist || '').toLowerCase();
        const songAlbum = (songDataTyped.album || '').toLowerCase();
        const songLyrics = (songDataTyped.lyrics || '').toLowerCase();

        if (byArtist && songArtist === targetArtist) similarityScore += 10;
        if (byAlbum && songAlbum === targetAlbum) similarityScore += 8;
        if (byTheme && songLyrics && targetLyrics) {
          // Simple theme matching - find common words
          const targetWords = new Set(targetLyrics.split(/\s+/).filter(w => w.length > 3));
          const songWords = new Set(songLyrics.split(/\s+/).filter(w => w.length > 3));
          const commonWords = Array.from(targetWords).filter(w => songWords.has(w));
          similarityScore += Math.min(commonWords.length, 5);
        }

        if (similarityScore > 0) {
          similarSongs.push({
            song: { id: songId, ...songDataTyped } as Song,
            similarityScore
          });
        }
      }

      similarSongs.sort((a, b) => b.similarityScore - a.similarityScore);
      const topSimilar = similarSongs.slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            targetSong: {
              id: targetSong.id,
              title: targetSong.title,
              artist: targetSong.artist,
              album: targetSong.album
            },
            similarSongs: topSimilar.map(item => ({
              id: item.song.id,
              title: item.song.title,
              artist: item.song.artist,
              album: item.song.album,
              similarityScore: item.similarityScore
            })),
            count: topSimilar.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error finding similar songs: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Search with suggestions implementation
   */
  private async searchWithSuggestions(args: { query: string; limit?: number }): Promise<MCPToolResult> {
    // First try regular search
    const searchResult = await this.searchSongs({ query: args.query, limit: args.limit || 20 });
    
    if (searchResult.isError) {
      return searchResult;
    }

    try {
      const resultData = JSON.parse(searchResult.content[0].text);
      
      if (resultData.count > 0) {
        return searchResult; // Return regular results if found
      }

      // No results found - generate suggestions
      const user = this.authService.getCurrentUser();
      if (!user) {
        return searchResult;
      }

      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              songs: [],
              count: 0,
              suggestions: ['No songs found in library'],
              query: args.query
            }, null, 2)
          }]
        };
      }

      const allSongs = snapshot.val();
      const artists = new Set<string>();
      const albums = new Set<string>();
      const titles: string[] = [];

      // Get user groups for access checking
      const userGroupsRef = ref(database, `groupMemberships/${user.id}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      for (const [songId, songData] of Object.entries(allSongs)) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === user.id) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(user.id)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (hasAccess) {
          if (songDataTyped.artist) artists.add(songDataTyped.artist);
          if (songDataTyped.album) albums.add(songDataTyped.album);
          if (songDataTyped.title) titles.push(songDataTyped.title);
        }
      }

      const queryLower = args.query.toLowerCase();
      const suggestions: string[] = [];

      // Find similar artists
      Array.from(artists).forEach(artist => {
        if (artist.toLowerCase().includes(queryLower) || queryLower.includes(artist.toLowerCase().substring(0, 3))) {
          suggestions.push(`Try searching for artist: "${artist}"`);
        }
      });

      // Find similar titles
      titles.slice(0, 10).forEach(title => {
        if (title.toLowerCase().includes(queryLower) || queryLower.includes(title.toLowerCase().substring(0, 3))) {
          suggestions.push(`Try searching for: "${title}"`);
        }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songs: [],
            count: 0,
            query: args.query,
            message: 'No exact matches found',
            suggestions: suggestions.length > 0 ? suggestions.slice(0, 5) : [
              'Try a different search term',
              'Check spelling',
              'Use get_library_statistics to see available artists and albums'
            ]
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return searchResult; // Return original result if parsing fails
    }
  }

  /**
   * Get user info implementation
   */
  private async getUserInfo(args: Record<string, any>): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const favoriteIds = await this.favoritesService.getFavoriteSongs();
      const playlists = await this.playlistService.getUserPlaylists(user.id);
      const groups = await this.groupService.getUserGroups(user.id);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatar: user.avatar,
            emailVerified: user.emailVerified,
            preferences: {
              theme: user.preferences.theme,
              defaultPlaybackSpeed: user.preferences.defaultPlaybackSpeed,
              autoPlay: user.preferences.autoPlay,
              language: user.preferences.language,
              defaultTab: user.preferences.defaultTab
            },
            stats: {
              totalSessions: user.stats.totalSessions,
              totalPlayTime: user.stats.totalPlayTime,
              joinedDate: user.stats.joinedDate,
              lastSessionDate: user.stats.lastSessionDate,
              favoriteArtists: user.stats.favoriteArtists,
              favoriteSongsCount: favoriteIds.length
            },
            createdAt: user.createdAt,
            lastActiveAt: user.lastActiveAt,
            playlistsCount: playlists.length,
            groupsCount: groups.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting user info: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get playlist details implementation
   */
  private async getPlaylistDetails(args: { playlistId: string; includeSongDetails?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const playlists = await this.playlistService.getUserPlaylists(user.id);
      const playlist = playlists.find(p => p.id === args.playlistId);

      if (!playlist) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Playlist with ID "${args.playlistId}" not found` }, null, 2)
          }],
          isError: true
        };
      }

      let songsData = playlist.songs || [];
      if (args.includeSongDetails) {
        // Get full song details for each playlist item
        const songsRef = ref(database, 'songs');
        const snapshot = await get(songsRef);
        if (snapshot.exists()) {
          const allSongs = snapshot.val();
          songsData = (playlist.songs || []).map(item => {
            const songData = allSongs[item.songId];
            return {
              ...item,
              songDetails: songData ? {
                id: item.songId,
                title: songData.title,
                artist: songData.artist,
                album: songData.album,
                hasLyrics: !!songData.lyrics,
                tracksCount: songData.tracks?.length || 0,
                scoresCount: songData.scores?.length || 0
              } : null
            };
          });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: playlist.id,
            name: playlist.name,
            description: playlist.description,
            userId: playlist.userId,
            isPublic: playlist.isPublic,
            playCount: playlist.playCount,
            lastPlayedAt: playlist.lastPlayedAt,
            createdAt: playlist.createdAt,
            updatedAt: playlist.updatedAt,
            songs: songsData,
            songCount: songsData.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting playlist details: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get group details implementation
   */
  private async getGroupDetails(args: { groupId: string; includeMembers?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const groups = await this.groupService.getUserGroups(user.id);
      const group = groups.find(g => g.id === args.groupId);

      if (!group) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Group with ID "${args.groupId}" not found or user is not a member` }, null, 2)
          }],
          isError: true
        };
      }

      let membersData: any[] = [];
      if (args.includeMembers !== false && group.members && group.members.length > 0) {
        // Get member details
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
          const allUsers = snapshot.val();
          membersData = group.members.map(memberId => {
            const userData = allUsers[memberId];
            return userData ? {
              id: memberId,
              email: userData.email,
              displayName: userData.displayName,
              avatar: userData.avatar
            } : { id: memberId, displayName: 'Unknown User' };
          });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: group.id,
            name: group.name,
            description: group.description,
            createdBy: group.createdBy,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
            isActive: group.isActive,
            isAdmin: group.isAdmin,
            color: group.color,
            icon: group.icon,
            members: args.includeMembers !== false ? membersData : undefined,
            memberCount: group.members?.length || 0
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting group details: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get song access control implementation
   */
  private async getSongAccessControl(args: { songId: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const songRef = ref(database, `songs/${args.songId}`);
      const snapshot = await get(songRef);
      
      if (!snapshot.exists()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Song with ID "${args.songId}" not found` }, null, 2)
          }],
          isError: true
        };
      }

      const songData = snapshot.val() as any;
      const hasAccess = await this.songAccessService.checkSongAccess(args.songId, user.id);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songId: args.songId,
            title: songData.title,
            artist: songData.artist,
            createdBy: songData.createdBy,
            userHasAccess: hasAccess,
            accessControl: songData.accessControl || {
              visibility: 'public',
              accessLevel: 'read',
              note: 'No explicit access control - song is public'
            },
            visibility: songData.accessControl?.visibility || 'public',
            accessLevel: songData.accessControl?.accessLevel || 'read',
            allowedUsers: songData.accessControl?.allowedUsers || [],
            allowedGroups: songData.accessControl?.allowedGroups || [],
            allowedUsersCount: songData.accessControl?.allowedUsers?.length || 0,
            allowedGroupsCount: songData.accessControl?.allowedGroups?.length || 0
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting song access control: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get song state implementation
   */
  private async getSongState(args: { songId: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      this.songStateService.setUserId(user.id);
      const songState = await this.songStateService.getSongState(args.songId);

      if (!songState) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              songId: args.songId,
              state: null,
              message: 'No saved state found for this song'
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songId: songState.songId,
            activeTrackIds: songState.activeTrackIds,
            soloedTrackIds: songState.soloedTrackIds,
            trackVolumes: songState.trackVolumes,
            lastUpdated: songState.lastUpdated,
            activeTracksCount: songState.activeTrackIds.length,
            soloedTracksCount: songState.soloedTrackIds.length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting song state: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get track states implementation
   */
  private async getTrackStates(args: { songId: string }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      this.trackStateService.setCurrentUser(user.id);
      const trackStates = await this.trackStateService.loadSongTrackStates(args.songId);

      if (!trackStates) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              songId: args.songId,
              trackStates: null,
              message: 'No saved track states found for this song'
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            songId: args.songId,
            trackStates: Object.entries(trackStates).map(([trackId, state]) => ({
              trackId,
              solo: state.solo,
              mute: state.mute,
              volume: state.volume
            })),
            tracksCount: Object.keys(trackStates).length
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting track states: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Get all user data implementation
   */
  private async getAllUserData(args: { includeSongStates?: boolean }): Promise<MCPToolResult> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      return {
        content: [{ type: 'text', text: 'Error: User not authenticated' }],
        isError: true
      };
    }

    try {
      const includeSongStates = args.includeSongStates !== false;
      
      // Get all user-related data
      const favoriteIds = await this.favoritesService.getFavoriteSongs();
      const favoriteSongs = await this.favoritesService.getFavoriteSongsWithData();
      const playlists = await this.playlistService.getUserPlaylists(user.id);
      const groups = await this.groupService.getUserGroups(user.id);
      const allSongs = await this.getAccessibleSongsForUser(user.id);

      let songStates: any = null;
      let trackStates: any = null;

      if (includeSongStates) {
        this.songStateService.setUserId(user.id);
        this.trackStateService.setCurrentUser(user.id);
        
        const allSongStates = await this.songStateService.getAllStates();
        songStates = Object.fromEntries(allSongStates);
        
        trackStates = await this.trackStateService.loadAllTrackStates();
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            user: {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              avatar: user.avatar,
              emailVerified: user.emailVerified,
              preferences: user.preferences,
              stats: user.stats,
              createdAt: user.createdAt,
              lastActiveAt: user.lastActiveAt
            },
            favorites: {
              count: favoriteIds.length,
              songIds: favoriteIds,
              songs: favoriteSongs.map((song: any) => ({
                id: song.id,
                title: song.title,
                artist: song.artist
              }))
            },
            playlists: playlists.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              songCount: p.songs?.length || 0,
              isPublic: p.isPublic,
              playCount: p.playCount
            })),
            groups: groups.map(g => ({
              id: g.id,
              name: g.name,
              description: g.description,
              memberCount: g.members?.length || 0,
              isAdmin: g.isAdmin
            })),
            library: {
              totalSongs: allSongs.length,
              songsWithLyrics: allSongs.filter(s => s.lyrics).length,
              songsWithTracks: allSongs.filter(s => s.tracks && s.tracks.length > 0).length,
              songsWithScores: allSongs.filter(s => s.scores && s.scores.length > 0).length
            },
            songStates: includeSongStates ? songStates : undefined,
            trackStates: includeSongStates ? trackStates : undefined
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error getting all user data: ${error.message}` }],
        isError: true
      };
    }
  }

  /**
   * Helper method to get accessible songs for a user
   */
  private async getAccessibleSongsForUser(userId: string): Promise<Song[]> {
    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      const allSongs = snapshot.val();
      const songEntries = Object.entries(allSongs);
      
      // Get user groups
      const userGroupsRef = ref(database, `groupMemberships/${userId}`);
      const userGroupsSnapshot = await get(userGroupsRef);
      const userGroupIds: string[] = [];
      
      if (userGroupsSnapshot.exists()) {
        const userGroups = userGroupsSnapshot.val();
        userGroupIds.push(...Object.keys(userGroups).filter(
          groupId => userGroups[groupId]?.isActive !== false
        ));
      }

      const accessibleSongs: Song[] = [];

      for (const [songId, songData] of songEntries) {
        const songDataTyped = songData as any;
        
        // Check access
        let hasAccess = false;
        if (!songDataTyped.accessControl) {
          hasAccess = true;
        } else {
          const accessControl = songDataTyped.accessControl;
          if (accessControl.visibility === 'public') {
            hasAccess = true;
          } else if (songDataTyped.createdBy === userId) {
            hasAccess = true;
          } else if (accessControl.allowedUsers?.includes(userId)) {
            hasAccess = true;
          } else if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
            hasAccess = accessControl.allowedGroups.some(
              (allowedGroupId: string) => userGroupIds.includes(allowedGroupId)
            );
          }
        }

        if (hasAccess) {
          accessibleSongs.push({
            id: songId,
            ...songDataTyped
          } as Song);
        }
      }

      return accessibleSongs;
    } catch (error) {
      console.error('Error getting accessible songs:', error);
      return [];
    }
  }

  /**
   * Format tools as JSON schema for AI models
   */
  public getToolsAsJSONSchema(): string {
    return JSON.stringify(this.tools, null, 2);
  }

  /**
   * Generate tool descriptions for AI prompts
   */
  public getToolsDescription(): string {
    let description = 'Available MCP Tools:\n\n';
    this.tools.forEach(tool => {
      description += `- ${tool.name}: ${tool.description}\n`;
      if (tool.inputSchema.properties) {
        const props = Object.entries(tool.inputSchema.properties);
        if (props.length > 0) {
          description += '  Parameters:\n';
          props.forEach(([key, value]: [string, any]) => {
            description += `    - ${key} (${value.type}): ${value.description || 'No description'}\n`;
          });
        }
      }
      description += '\n';
    });
    return description;
  }
}

export default MCPClientService;
export type { MCPTool, MCPResource, MCPToolCall, MCPToolResult };

