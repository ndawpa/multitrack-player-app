import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';
import AuthService from './authService';

class FavoritesService {
  private static instance: FavoritesService;
  private authService: AuthService;

  private constructor() {
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  /**
   * Get user's favorite songs
   */
  public async getFavoriteSongs(): Promise<string[]> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${user.id}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        return userData.stats?.favoriteSongs || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting favorite songs:', error);
      throw error;
    }
  }

  /**
   * Add a song to favorites
   */
  public async addToFavorites(songId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${user.id}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const currentFavorites = userData.stats?.favoriteSongs || [];
        
        if (!currentFavorites.includes(songId)) {
          const updatedFavorites = [...currentFavorites, songId];
          
          await update(userRef, {
            'stats/favoriteSongs': updatedFavorites
          });
        }
      }
    } catch (error) {
      console.error('Error adding song to favorites:', error);
      throw error;
    }
  }

  /**
   * Remove a song from favorites
   */
  public async removeFromFavorites(songId: string): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${user.id}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const currentFavorites = userData.stats?.favoriteSongs || [];
        
        const updatedFavorites = currentFavorites.filter((id: string) => id !== songId);
        
        await update(userRef, {
          'stats/favoriteSongs': updatedFavorites
        });
      }
    } catch (error) {
      console.error('Error removing song from favorites:', error);
      throw error;
    }
  }

  /**
   * Toggle favorite status of a song
   */
  public async toggleFavorite(songId: string): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      const currentFavorites = await this.getFavoriteSongs();
      const isFavorite = currentFavorites.includes(songId);
      
      if (isFavorite) {
        await this.removeFromFavorites(songId);
        return false;
      } else {
        await this.addToFavorites(songId);
        return true;
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Check if a song is favorited
   */
  public async isFavorite(songId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavoriteSongs();
      return favorites.includes(songId);
    } catch (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }
  }

  /**
   * Get favorite songs with full song data
   */
  public async getFavoriteSongsWithData(): Promise<any[]> {
    try {
      const favoriteIds = await this.getFavoriteSongs();
      if (favoriteIds.length === 0) {
        return [];
      }

      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (snapshot.exists()) {
        const allSongs = snapshot.val();
        const favoriteSongs = favoriteIds
          .map(id => allSongs[id])
          .filter(song => song !== undefined)
          .map((song, index) => ({
            id: favoriteIds[index],
            ...song
          }));
        
        return favoriteSongs;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting favorite songs with data:', error);
      throw error;
    }
  }
}

export default FavoritesService;
