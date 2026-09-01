import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song } from '../types/song';

interface CachedSongCatalog {
  version: 1;
  updatedAt: number;
  songs: Song[];
}

class SongCatalogCacheService {
  private static readonly KEY_PREFIX = 'song_catalog_v1_';

  private static keyForUser(userId: string): string {
    return `${this.KEY_PREFIX}${userId}`;
  }

  static async load(userId: string): Promise<Song[]> {
    try {
      const value = await AsyncStorage.getItem(this.keyForUser(userId));
      if (!value) return [];

      const cached = JSON.parse(value) as CachedSongCatalog;
      if (cached.version !== 1 || !Array.isArray(cached.songs)) return [];

      return cached.songs;
    } catch (error) {
      console.warn('Could not load the cached song catalog:', error);
      return [];
    }
  }

  static async save(userId: string, songs: Song[]): Promise<void> {
    const catalog: CachedSongCatalog = {
      version: 1,
      updatedAt: Date.now(),
      songs,
    };

    try {
      await AsyncStorage.setItem(this.keyForUser(userId), JSON.stringify(catalog));
    } catch (error) {
      // A cache write must never prevent the online catalog from being displayed.
      console.warn('Could not cache the song catalog:', error);
    }
  }
}

export default SongCatalogCacheService;
