import { ref, set, get, push, remove, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';
import { Playlist, PlaylistItem, CreatePlaylistForm, UpdatePlaylistForm, AddSongToPlaylistForm, ReorderPlaylistForm } from '../types/playlist';
import { Song } from '../types/song';

class PlaylistService {
  private static instance: PlaylistService;

  private constructor() {}

  public static getInstance(): PlaylistService {
    if (!PlaylistService.instance) {
      PlaylistService.instance = new PlaylistService();
    }
    return PlaylistService.instance;
  }

  /**
   * Create a new playlist
   */
  public async createPlaylist(userId: string, playlistData: CreatePlaylistForm): Promise<Playlist> {
    try {
      const playlistId = this.generateId();
      const now = new Date();
      
      const playlist: Playlist = {
        id: playlistId,
        name: playlistData.name,
        description: playlistData.description,
        userId,
        songs: [],
        createdAt: now,
        updatedAt: now,
        isPublic: playlistData.isPublic || false,
        playCount: 0
      };

      const playlistRef = ref(database, `playlists/${playlistId}`);
      await set(playlistRef, this.cleanPlaylistDataForFirebase(playlist));

      return playlist;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw new Error('Failed to create playlist');
    }
  }

  /**
   * Get all playlists for a user
   */
  public async getUserPlaylists(userId: string): Promise<Playlist[]> {
    try {
      const playlistsRef = ref(database, 'playlists');
      const userPlaylistsQuery = query(playlistsRef, orderByChild('userId'), equalTo(userId));
      
      const snapshot = await get(userPlaylistsQuery);
      if (!snapshot.exists()) {
        return [];
      }

      const playlists: Playlist[] = [];
      snapshot.forEach((childSnapshot) => {
        const playlistData = childSnapshot.val();
        playlists.push(this.parsePlaylistFromFirebase(playlistData));
      });

      return playlists.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error('Error fetching user playlists:', error);
      throw new Error('Failed to fetch playlists');
    }
  }

  /**
   * Get a specific playlist by ID
   */
  public async getPlaylist(playlistId: string): Promise<Playlist | null> {
    try {
      const playlistRef = ref(database, `playlists/${playlistId}`);
      const snapshot = await get(playlistRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      return this.parsePlaylistFromFirebase(snapshot.val());
    } catch (error) {
      console.error('Error fetching playlist:', error);
      throw new Error('Failed to fetch playlist');
    }
  }

  /**
   * Update playlist metadata
   */
  public async updatePlaylist(playlistId: string, updateData: UpdatePlaylistForm): Promise<void> {
    try {
      const playlistRef = ref(database, `playlists/${playlistId}`);
      const updates: any = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };

      await set(playlistRef, { ...updates }, { merge: true });
    } catch (error) {
      console.error('Error updating playlist:', error);
      throw new Error('Failed to update playlist');
    }
  }

  /**
   * Delete a playlist
   */
  public async deletePlaylist(playlistId: string): Promise<void> {
    try {
      const playlistRef = ref(database, `playlists/${playlistId}`);
      await remove(playlistRef);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      throw new Error('Failed to delete playlist');
    }
  }

  /**
   * Add a song to a playlist
   */
  public async addSongToPlaylist(playlistId: string, songData: AddSongToPlaylistForm, song: Song): Promise<void> {
    try {
      // Validate song object
      if (!song || !song.id || !song.title || !song.artist) {
        throw new Error('Invalid song data provided');
      }

      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      // Check if song is already in playlist
      const existingSong = playlist.songs.find(item => item.songId === songData.songId);
      if (existingSong) {
        throw new Error('Song is already in this playlist');
      }

      const newPlaylistItem: any = {
        id: this.generateId(),
        songId: songData.songId,
        songTitle: song.title,
        songArtist: song.artist,
        position: songData.position !== undefined ? songData.position : playlist.songs.length,
        addedAt: new Date()
      };

      // Only include notes if it has a value
      if (songData.notes && songData.notes.trim()) {
        newPlaylistItem.notes = songData.notes;
      }

      // If position is specified, adjust other songs' positions
      if (songData.position !== undefined) {
        playlist.songs.forEach(item => {
          if (item.position >= songData.position!) {
            item.position += 1;
          }
        });
      }

      playlist.songs.push(newPlaylistItem);
      playlist.updatedAt = new Date();

      const playlistRef = ref(database, `playlists/${playlistId}`);
      await set(playlistRef, this.cleanPlaylistDataForFirebase(playlist));
    } catch (error) {
      console.error('Error adding song to playlist:', error);
      throw new Error('Failed to add song to playlist');
    }
  }

  /**
   * Remove a song from a playlist
   */
  public async removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
    try {
      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      const songIndex = playlist.songs.findIndex(item => item.songId === songId);
      
      if (songIndex === -1) {
        throw new Error('Song not found in playlist');
      }

      const removedPosition = playlist.songs[songIndex].position;
      playlist.songs.splice(songIndex, 1);

      // Adjust positions of remaining songs
      playlist.songs.forEach(item => {
        if (item.position > removedPosition) {
          item.position -= 1;
        }
      });

      playlist.updatedAt = new Date();

      const playlistRef = ref(database, `playlists/${playlistId}`);
      await set(playlistRef, this.cleanPlaylistDataForFirebase(playlist));
    } catch (error) {
      console.error('Error removing song from playlist:', error);
      throw error;
    }
  }

  /**
   * Reorder songs in a playlist
   */
  public async reorderPlaylist(playlistId: string, reorderData: ReorderPlaylistForm): Promise<void> {
    try {
      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      const songIndex = playlist.songs.findIndex(item => item.songId === reorderData.songId);
      if (songIndex === -1) {
        throw new Error('Song not found in playlist');
      }

      const oldPosition = playlist.songs[songIndex].position;
      const newPosition = reorderData.newPosition;

      if (oldPosition === newPosition) {
        return; // No change needed
      }

      // Update the moved song's position
      playlist.songs[songIndex].position = newPosition;

      // Adjust other songs' positions
      playlist.songs.forEach((item, index) => {
        if (index !== songIndex) {
          if (oldPosition < newPosition) {
            // Moving down: shift songs between old and new position up
            if (item.position > oldPosition && item.position <= newPosition) {
              item.position -= 1;
            }
          } else {
            // Moving up: shift songs between new and old position down
            if (item.position >= newPosition && item.position < oldPosition) {
              item.position += 1;
            }
          }
        }
      });

      playlist.updatedAt = new Date();

      const playlistRef = ref(database, `playlists/${playlistId}`);
      await set(playlistRef, this.cleanPlaylistDataForFirebase(playlist));
    } catch (error) {
      console.error('Error reordering playlist:', error);
      throw new Error('Failed to reorder playlist');
    }
  }

  /**
   * Update playlist play count and last played time
   */
  public async updatePlaylistStats(playlistId: string): Promise<void> {
    try {
      const playlistRef = ref(database, `playlists/${playlistId}`);
      const updates = {
        playCount: 1, // This will be incremented by Firebase
        lastPlayedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await set(playlistRef, updates, { merge: true });
    } catch (error) {
      console.error('Error updating playlist stats:', error);
      throw new Error('Failed to update playlist stats');
    }
  }

  /**
   * Listen to playlist changes in real-time
   */
  public subscribeToPlaylist(playlistId: string, callback: (playlist: Playlist | null) => void): () => void {
    const playlistRef = ref(database, `playlists/${playlistId}`);
    
    const unsubscribe = onValue(playlistRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(this.parsePlaylistFromFirebase(snapshot.val()));
      } else {
        callback(null);
      }
    });

    return () => off(playlistRef, 'value', unsubscribe);
  }

  /**
   * Listen to user's playlists in real-time
   */
  public subscribeToUserPlaylists(userId: string, callback: (playlists: Playlist[]) => void): () => void {
    const playlistsRef = ref(database, 'playlists');
    const userPlaylistsQuery = query(playlistsRef, orderByChild('userId'), equalTo(userId));
    
    const unsubscribe = onValue(userPlaylistsQuery, (snapshot) => {
      const playlists: Playlist[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          playlists.push(this.parsePlaylistFromFirebase(childSnapshot.val()));
        });
      }
      callback(playlists.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    });

    return () => off(playlistsRef, 'value', unsubscribe);
  }

  /**
   * Get songs from a playlist with full song data
   */
  public async getPlaylistSongs(playlistId: string): Promise<{ playlist: Playlist; songs: Song[] }> {
    try {
      const playlist = await this.getPlaylist(playlistId);
      if (!playlist) {
        throw new Error('Playlist not found');
      }

      // Get full song data for each playlist item
      const songs: Song[] = [];
      for (const item of playlist.songs || []) {
        try {
          const songRef = ref(database, `songs/${item.songId}`);
          const songSnapshot = await get(songRef);
          if (songSnapshot.exists()) {
            const songData = songSnapshot.val();
            // Add the song ID to the song data
            songs.push({
              ...songData,
              id: item.songId
            } as Song);
          }
        } catch (error) {
          console.warn(`Failed to load song ${item.songId}:`, error);
        }
      }

      return { playlist, songs };
    } catch (error) {
      console.error('Error getting playlist songs:', error);
      throw new Error('Failed to get playlist songs');
    }
  }

  // Helper methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private cleanPlaylistDataForFirebase(playlist: Playlist): any {
    const cleanedData: any = {
      ...playlist,
      createdAt: playlist.createdAt.toISOString(),
      updatedAt: playlist.updatedAt.toISOString(),
      songs: playlist.songs ? playlist.songs.map(item => {
        const cleanedItem: any = {
          ...item,
          addedAt: item.addedAt.toISOString()
        };
        
        // Only include notes if it exists and has a value
        if (item.notes && item.notes.trim()) {
          cleanedItem.notes = item.notes;
        }
        
        return cleanedItem;
      }) : []
    };

    // Only include lastPlayedAt if it exists
    if (playlist.lastPlayedAt) {
      cleanedData.lastPlayedAt = playlist.lastPlayedAt.toISOString();
    }

    return cleanedData;
  }

  private parsePlaylistFromFirebase(data: any): Playlist {
    const playlist: any = {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      songs: data.songs ? data.songs.map((item: any) => ({
        ...item,
        addedAt: new Date(item.addedAt)
      })) : []
    };

    // Only include lastPlayedAt if it exists in the data
    if (data.lastPlayedAt) {
      playlist.lastPlayedAt = new Date(data.lastPlayedAt);
    }

    return playlist;
  }
}

export default PlaylistService;
