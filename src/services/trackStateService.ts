import { ref, set, get, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';

export interface TrackState {
  solo: boolean;
  mute: boolean;
  volume: number;
}

export interface SongTrackStates {
  [trackId: string]: TrackState;
}

export interface UserTrackStates {
  [songId: string]: SongTrackStates;
}

class TrackStateService {
  private static instance: TrackStateService;
  private currentUserId: string | null = null;
  private listeners: { [songId: string]: () => void } = {};

  private constructor() {}

  public static getInstance(): TrackStateService {
    if (!TrackStateService.instance) {
      TrackStateService.instance = new TrackStateService();
    }
    return TrackStateService.instance;
  }

  public setCurrentUser(userId: string | null) {
    this.currentUserId = userId;
    // Clear existing listeners when user changes
    this.clearAllListeners();
  }

  private clearAllListeners() {
    Object.values(this.listeners).forEach(unsubscribe => unsubscribe());
    this.listeners = {};
  }

  private getUserTrackStatesRef() {
    if (!this.currentUserId) {
      throw new Error('No user ID set');
    }
    return ref(database, `users/${this.currentUserId}/trackStates`);
  }

  private getSongTrackStatesRef(songId: string) {
    if (!this.currentUserId) {
      throw new Error('No user ID set');
    }
    return ref(database, `users/${this.currentUserId}/trackStates/${songId}`);
  }

  /**
   * Save track states for a specific song
   */
  public async saveSongTrackStates(songId: string, trackStates: SongTrackStates): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('No user ID set, cannot save track states');
        return;
      }

      const songRef = this.getSongTrackStatesRef(songId);
      await set(songRef, trackStates);
      console.log('Track states saved for song:', songId);
    } catch (error) {
      console.error('Error saving track states:', error);
      throw error;
    }
  }

  /**
   * Load track states for a specific song
   */
  public async loadSongTrackStates(songId: string): Promise<SongTrackStates | null> {
    try {
      if (!this.currentUserId) {
        console.warn('No user ID set, cannot load track states');
        return null;
      }

      const songRef = this.getSongTrackStatesRef(songId);
      const snapshot = await get(songRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error('Error loading track states:', error);
      return null;
    }
  }

  /**
   * Save a single track state
   */
  public async saveTrackState(songId: string, trackId: string, trackState: TrackState): Promise<void> {
    try {
      if (!this.currentUserId) {
        console.warn('No user ID set, cannot save track state');
        return;
      }

      const trackRef = ref(database, `users/${this.currentUserId}/trackStates/${songId}/${trackId}`);
      await set(trackRef, trackState);
    } catch (error) {
      console.error('Error saving track state:', error);
      throw error;
    }
  }

  /**
   * Load all track states for a user
   */
  public async loadAllTrackStates(): Promise<UserTrackStates | null> {
    try {
      if (!this.currentUserId) {
        console.warn('No user ID set, cannot load track states');
        return null;
      }

      const userRef = this.getUserTrackStatesRef();
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      return null;
    } catch (error) {
      console.error('Error loading all track states:', error);
      return null;
    }
  }

  /**
   * Listen to track state changes for a specific song in real-time
   */
  public listenToSongTrackStates(
    songId: string, 
    callback: (trackStates: SongTrackStates | null) => void
  ): () => void {
    if (!this.currentUserId) {
      console.warn('No user ID set, cannot listen to track states');
      return () => {};
    }

    // Remove existing listener for this song
    if (this.listeners[songId]) {
      this.listeners[songId]();
    }

    const songRef = this.getSongTrackStatesRef(songId);
    const unsubscribe = onValue(songRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.val());
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to track states:', error);
      callback(null);
    });

    this.listeners[songId] = unsubscribe;
    return unsubscribe;
  }

  /**
   * Get default track state
   */
  public getDefaultTrackState(): TrackState {
    return {
      solo: false,
      mute: false,
      volume: 1.0
    };
  }

  /**
   * Initialize track states for a song with default values
   */
  public async initializeSongTrackStates(songId: string, trackIds: string[]): Promise<SongTrackStates> {
    const defaultStates: SongTrackStates = {};
    
    trackIds.forEach(trackId => {
      defaultStates[trackId] = this.getDefaultTrackState();
    });

    await this.saveSongTrackStates(songId, defaultStates);
    return defaultStates;
  }

  /**
   * Clean up resources
   */
  public cleanup() {
    this.clearAllListeners();
    this.currentUserId = null;
  }
}

export default TrackStateService;
