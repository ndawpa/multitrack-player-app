import { ref, set, get, remove } from 'firebase/database';
import { database } from '../config/firebase';

export interface SongState {
  songId: string;
  activeTrackIds: string[];
  soloedTrackIds: string[];
  trackVolumes: { [key: string]: number };
  lastUpdated: number;
}

class SongStateService {
  private static instance: SongStateService;
  private songStates: Map<string, SongState> = new Map();
  private currentUserId: string | null = null;

  private constructor() {}

  public static getInstance(): SongStateService {
    if (!SongStateService.instance) {
      SongStateService.instance = new SongStateService();
    }
    return SongStateService.instance;
  }

  /**
   * Set the current user ID for database operations
   */
  public setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Get the database path for user's song states
   */
  private getUserSongStatesPath(): string {
    if (!this.currentUserId) {
      throw new Error('User ID not set. Call setUserId() first.');
    }
    return `users/${this.currentUserId}/songStates`;
  }

  /**
   * Get the database path for a specific song state
   */
  private getSongStatePath(songId: string): string {
    return `${this.getUserSongStatesPath()}/${songId}`;
  }

  /**
   * Get the state for a specific song from database
   */
  public async getSongState(songId: string): Promise<SongState | null> {
    try {
      const songStateRef = ref(database, this.getSongStatePath(songId));
      const snapshot = await get(songStateRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          songId,
          activeTrackIds: data.activeTrackIds || [],
          soloedTrackIds: data.soloedTrackIds || [],
          trackVolumes: data.trackVolumes || {},
          lastUpdated: data.lastUpdated || Date.now(),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting song state:', error);
      return null;
    }
  }

  /**
   * Save the state for a specific song to database
   */
  public async saveSongState(songId: string, state: Partial<Omit<SongState, 'songId' | 'lastUpdated'>>): Promise<void> {
    try {
      const songStateRef = ref(database, this.getSongStatePath(songId));
      const newState: Omit<SongState, 'songId'> = {
        activeTrackIds: state.activeTrackIds || [],
        soloedTrackIds: state.soloedTrackIds || [],
        trackVolumes: state.trackVolumes || {},
        lastUpdated: Date.now(),
      };

      await set(songStateRef, newState);
      console.log('Song state saved to database for:', songId);
    } catch (error) {
      console.error('Error saving song state:', error);
      throw error;
    }
  }

  /**
   * Update specific properties of a song's state
   */
  public async updateSongState(songId: string, updates: Partial<Omit<SongState, 'songId' | 'lastUpdated'>>): Promise<void> {
    try {
      const songStateRef = ref(database, this.getSongStatePath(songId));
      const currentSnapshot = await get(songStateRef);
      
      let currentState: any = {};
      if (currentSnapshot.exists()) {
        currentState = currentSnapshot.val();
      }

      const updatedState = {
        ...currentState,
        ...updates,
        lastUpdated: Date.now(),
      };

      await set(songStateRef, updatedState);
      console.log('Song state updated in database for:', songId);
    } catch (error) {
      console.error('Error updating song state:', error);
      throw error;
    }
  }

  /**
   * Clear the state for a specific song
   */
  public async clearSongState(songId: string): Promise<void> {
    try {
      const songStateRef = ref(database, this.getSongStatePath(songId));
      await remove(songStateRef);
      console.log('Song state cleared from database for:', songId);
    } catch (error) {
      console.error('Error clearing song state:', error);
      throw error;
    }
  }

  /**
   * Clear all song states for the current user
   */
  public async clearAllStates(): Promise<void> {
    try {
      const userSongStatesRef = ref(database, this.getUserSongStatesPath());
      await remove(userSongStatesRef);
      console.log('All song states cleared from database for user:', this.currentUserId);
    } catch (error) {
      console.error('Error clearing all song states:', error);
      throw error;
    }
  }

  /**
   * Get all stored song states for the current user
   */
  public async getAllStates(): Promise<Map<string, SongState>> {
    try {
      const userSongStatesRef = ref(database, this.getUserSongStatesPath());
      const snapshot = await get(userSongStatesRef);
      
      const states = new Map<string, SongState>();
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach(songId => {
          states.set(songId, {
            songId,
            activeTrackIds: data[songId].activeTrackIds || [],
            soloedTrackIds: data[songId].soloedTrackIds || [],
            trackVolumes: data[songId].trackVolumes || {},
            lastUpdated: data[songId].lastUpdated || Date.now(),
          });
        });
      }
      return states;
    } catch (error) {
      console.error('Error getting all song states:', error);
      return new Map();
    }
  }

  /**
   * Check if a song has stored state
   */
  public async hasSongState(songId: string): Promise<boolean> {
    try {
      const songStateRef = ref(database, this.getSongStatePath(songId));
      const snapshot = await get(songStateRef);
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking song state:', error);
      return false;
    }
  }
}

export default SongStateService;
