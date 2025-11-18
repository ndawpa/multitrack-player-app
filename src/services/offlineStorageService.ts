import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { Song, Track, Score } from '../types/song';

interface OfflineSongData {
  songId: string;
  tracks: { [trackId: string]: string }; // trackId -> localUri
  scores: { [scoreId: string]: string[] }; // scoreId -> array of localUris for pages
  cachedAt: number;
}

class OfflineStorageService {
  private static instance: OfflineStorageService;
  private cacheDirectory = `${FileSystem.cacheDirectory}offline/`;
  private offlineSongsKey = 'offline_songs';
  private offlineSongs: Set<string> = new Set();

  private constructor() {
    // Initialize cache directory
    FileSystem.makeDirectoryAsync(this.cacheDirectory, { intermediates: true })
      .catch(error => console.log('Offline cache directory already exists:', error));
    
    // Load offline songs list
    this.loadOfflineSongsList();
  }

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  private async loadOfflineSongsList(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.offlineSongsKey);
      if (data) {
        const songIds = JSON.parse(data);
        this.offlineSongs = new Set(songIds);
      }
    } catch (error) {
      console.error('Error loading offline songs list:', error);
    }
  }

  private async saveOfflineSongsList(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.offlineSongsKey, JSON.stringify(Array.from(this.offlineSongs)));
    } catch (error) {
      console.error('Error saving offline songs list:', error);
    }
  }

  /**
   * Check if a song is available offline
   */
  public isSongOffline(songId: string): boolean {
    return this.offlineSongs.has(songId);
  }

  /**
   * Get all offline song IDs
   */
  public getOfflineSongIds(): string[] {
    return Array.from(this.offlineSongs);
  }

  /**
   * Download and cache all tracks and scores for a song
   */
  public async downloadSongForOffline(song: Song): Promise<void> {
    try {
      const songCacheDir = `${this.cacheDirectory}${song.id}/`;
      await FileSystem.makeDirectoryAsync(songCacheDir, { intermediates: true });

      const offlineData: OfflineSongData = {
        songId: song.id,
        tracks: {},
        scores: {},
        cachedAt: Date.now()
      };

      // Download tracks
      if (song.tracks && song.tracks.length > 0) {
        for (const track of song.tracks) {
          try {
            const localUri = `${songCacheDir}tracks/${track.id}`;
            await FileSystem.makeDirectoryAsync(`${songCacheDir}tracks/`, { intermediates: true });

            // Get download URL from Firebase Storage
            const storageRef = ref(storage, track.path);
            const url = await getDownloadURL(storageRef);
            
            // Download and cache
            const downloadResult = await FileSystem.downloadAsync(url, localUri);
            offlineData.tracks[track.id] = downloadResult.uri;
          } catch (error) {
            console.error(`Error downloading track ${track.name}:`, error);
            throw error;
          }
        }
      }

      // Download scores
      if (song.scores && song.scores.length > 0) {
        for (const score of song.scores) {
          try {
            const scoreCacheDir = `${songCacheDir}scores/${score.id}/`;
            await FileSystem.makeDirectoryAsync(scoreCacheDir, { intermediates: true });

            const pages = score.pages || (score.url ? [score.url] : []);
            const cachedPages: string[] = [];

            for (let i = 0; i < pages.length; i++) {
              const pageUrl = pages[i];
              if (pageUrl === 'uploading') continue; // Skip uploading placeholders

              try {
                // If it's already a full URL, use it directly; otherwise treat as Firebase Storage path
                let downloadUrl: string;
                if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://')) {
                  downloadUrl = pageUrl;
                } else {
                  const storageRef = ref(storage, pageUrl);
                  downloadUrl = await getDownloadURL(storageRef);
                }

                const localUri = `${scoreCacheDir}page_${i}`;
                const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);
                cachedPages.push(downloadResult.uri);
              } catch (error) {
                console.error(`Error downloading score page ${i} for ${score.name}:`, error);
                // Continue with other pages even if one fails
              }
            }

            if (cachedPages.length > 0) {
              offlineData.scores[score.id] = cachedPages;
            }
          } catch (error) {
            console.error(`Error downloading score ${score.name}:`, error);
            // Continue with other scores even if one fails
          }
        }
      }

      // Save offline data metadata
      await AsyncStorage.setItem(`offline_song_${song.id}`, JSON.stringify(offlineData));

      // Add to offline songs list
      this.offlineSongs.add(song.id);
      await this.saveOfflineSongsList();

      console.log(`Song ${song.title} downloaded for offline use`);
    } catch (error) {
      console.error('Error downloading song for offline:', error);
      throw error;
    }
  }

  /**
   * Remove offline data for a song
   */
  public async removeOfflineSong(songId: string): Promise<void> {
    try {
      const songCacheDir = `${this.cacheDirectory}${song.id}/`;
      await FileSystem.deleteAsync(songCacheDir, { idempotent: true });
      await AsyncStorage.removeItem(`offline_song_${songId}`);

      // Remove from offline songs list
      this.offlineSongs.delete(songId);
      await this.saveOfflineSongsList();

      console.log(`Offline data removed for song ${songId}`);
    } catch (error) {
      console.error('Error removing offline song:', error);
      throw error;
    }
  }

  /**
   * Get cached track URI for offline use
   */
  public async getCachedTrackUri(track: Track, songId: string): Promise<string | null> {
    try {
      if (!this.isSongOffline(songId)) {
        return null;
      }

      const offlineDataStr = await AsyncStorage.getItem(`offline_song_${songId}`);
      if (!offlineDataStr) {
        return null;
      }

      const offlineData: OfflineSongData = JSON.parse(offlineDataStr);
      const localUri = offlineData.tracks[track.id];

      if (localUri) {
        // Verify file still exists
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          return localUri;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting cached track URI:', error);
      return null;
    }
  }

  /**
   * Get cached score page URIs for offline use
   */
  public async getCachedScorePages(score: Score, songId: string): Promise<string[] | null> {
    try {
      if (!this.isSongOffline(songId)) {
        return null;
      }

      const offlineDataStr = await AsyncStorage.getItem(`offline_song_${songId}`);
      if (!offlineDataStr) {
        return null;
      }

      const offlineData: OfflineSongData = JSON.parse(offlineDataStr);
      const cachedPages = offlineData.scores[score.id];

      if (cachedPages && cachedPages.length > 0) {
        // Verify files still exist
        const existingPages: string[] = [];
        for (const pageUri of cachedPages) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(pageUri);
            if (fileInfo.exists) {
              existingPages.push(pageUri);
            }
          } catch (error) {
            console.warn('Cached score page not found:', pageUri);
          }
        }

        if (existingPages.length > 0) {
          return existingPages;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting cached score pages:', error);
      return null;
    }
  }

  /**
   * Get offline data for a song
   */
  public async getOfflineSongData(songId: string): Promise<OfflineSongData | null> {
    try {
      const data = await AsyncStorage.getItem(`offline_song_${songId}`);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Error getting offline song data:', error);
      return null;
    }
  }

  /**
   * Clear all offline data
   */
  public async clearAllOfflineData(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.cacheDirectory, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.cacheDirectory, { intermediates: true });

      // Remove all offline song data from AsyncStorage
      const songIds = Array.from(this.offlineSongs);
      for (const songId of songIds) {
        await AsyncStorage.removeItem(`offline_song_${songId}`);
      }

      this.offlineSongs.clear();
      await this.saveOfflineSongsList();

      console.log('All offline data cleared');
    } catch (error) {
      console.error('Error clearing offline data:', error);
      throw error;
    }
  }
}

export default OfflineStorageService;

