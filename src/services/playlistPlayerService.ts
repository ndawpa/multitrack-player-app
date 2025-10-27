import { Audio } from 'expo-av';
import { Playlist } from '../types/playlist';
import { Song } from '../types/song';
import PlaylistService from './playlistService';
import AudioStorageService from './audioStorage';

export interface PlaylistPlayerState {
  currentPlaylist: Playlist | null;
  currentSongIndex: number;
  isPlaying: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
  currentSong: Song | null;
  progress: number;
  duration: number;
}

export interface PlaylistPlayerCallbacks {
  onSongChange?: (song: Song, index: number) => void;
  onPlaylistEnd?: () => void;
  onStateChange?: (state: PlaylistPlayerState) => void;
  onError?: (error: string) => void;
}

class PlaylistPlayerService {
  private static instance: PlaylistPlayerService;
  private currentState: PlaylistPlayerState;
  private callbacks: PlaylistPlayerCallbacks = {};
  private playlistService: PlaylistService;
  private currentPlayers: Audio.Sound[] = [];
  private isInitialized = false;

  private constructor() {
    this.currentState = {
      currentPlaylist: null,
      currentSongIndex: -1,
      isPlaying: false,
      isShuffled: false,
      isRepeating: false,
      currentSong: null,
      progress: 0,
      duration: 0
    };
    this.playlistService = PlaylistService.getInstance();
  }

  public static getInstance(): PlaylistPlayerService {
    if (!PlaylistPlayerService.instance) {
      PlaylistPlayerService.instance = new PlaylistPlayerService();
    }
    return PlaylistPlayerService.instance;
  }

  /**
   * Set callbacks for player events
   */
  public setCallbacks(callbacks: PlaylistPlayerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Load a playlist for playback
   */
  public async loadPlaylist(playlist: Playlist, songs: Song[]): Promise<void> {
    try {
      // Stop current playback
      await this.stop();

      // Update state
      this.currentState = {
        ...this.currentState,
        currentPlaylist: playlist,
        currentSongIndex: 0,
        isPlaying: false,
        currentSong: songs.length > 0 ? songs[0] : null,
        progress: 0,
        duration: 0
      };

      this.notifyStateChange();

      // Load first song if available
      if (songs.length > 0) {
        await this.loadCurrentSong();
      }

    } catch (error) {
      console.error('Error loading playlist:', error);
      this.callbacks.onError?.('Failed to load playlist');
    }
  }

  /**
   * Play the current song
   */
  public async play(): Promise<void> {
    try {
      if (!this.currentState.currentSong) {
        this.callbacks.onError?.('No song loaded');
        return;
      }

      if (this.currentPlayers.length === 0) {
        await this.loadCurrentSong();
      }

      // Play all active tracks
      await Promise.all(
        this.currentPlayers.map(player => player.playAsync())
      );

      this.currentState.isPlaying = true;
      this.notifyStateChange();

    } catch (error) {
      console.error('Error playing song:', error);
      this.callbacks.onError?.('Failed to play song');
    }
  }

  /**
   * Pause the current song
   */
  public async pause(): Promise<void> {
    try {
      await Promise.all(
        this.currentPlayers.map(player => player.pauseAsync())
      );

      this.currentState.isPlaying = false;
      this.notifyStateChange();

    } catch (error) {
      console.error('Error pausing song:', error);
      this.callbacks.onError?.('Failed to pause song');
    }
  }

  /**
   * Stop playback and reset
   */
  public async stop(): Promise<void> {
    try {
      await Promise.all(
        this.currentPlayers.map(player => player.stopAsync())
      );

      await this.unloadCurrentSong();

      this.currentState = {
        ...this.currentState,
        isPlaying: false,
        progress: 0,
        duration: 0
      };

      this.notifyStateChange();

    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }

  /**
   * Play next song in playlist
   */
  public async next(): Promise<void> {
    if (!this.currentState.currentPlaylist) return;

    const nextIndex = this.getNextSongIndex();
    if (nextIndex === -1) {
      // End of playlist
      this.callbacks.onPlaylistEnd?.();
      return;
    }

    await this.goToSong(nextIndex);
  }

  /**
   * Play previous song in playlist
   */
  public async previous(): Promise<void> {
    if (!this.currentState.currentPlaylist) return;

    const prevIndex = this.getPreviousSongIndex();
    if (prevIndex === -1) {
      // Beginning of playlist
      return;
    }

    await this.goToSong(prevIndex);
  }

  /**
   * Go to a specific song in the playlist
   */
  public async goToSong(index: number): Promise<void> {
    if (!this.currentState.currentPlaylist) return;

    const songs = await this.getCurrentPlaylistSongs();
    if (index < 0 || index >= songs.length) return;

    try {
      // Stop current song
      await this.stop();

      // Update state
      this.currentState.currentSongIndex = index;
      this.currentState.currentSong = songs[index];
      this.currentState.progress = 0;
      this.currentState.duration = 0;

      this.notifyStateChange();
      this.callbacks.onSongChange?.(songs[index], index);

      // Load and play new song
      await this.loadCurrentSong();
      if (this.currentState.isPlaying) {
        await this.play();
      }

    } catch (error) {
      console.error('Error going to song:', error);
      this.callbacks.onError?.('Failed to change song');
    }
  }

  /**
   * Toggle shuffle mode
   */
  public toggleShuffle(): void {
    this.currentState.isShuffled = !this.currentState.isShuffled;
    this.notifyStateChange();
  }

  /**
   * Toggle repeat mode
   */
  public toggleRepeat(): void {
    this.currentState.isRepeating = !this.currentState.isRepeating;
    this.notifyStateChange();
  }

  /**
   * Seek to a specific position in the current song
   */
  public async seekTo(position: number): Promise<void> {
    try {
      const positionMs = position * 1000; // Convert to milliseconds
      await Promise.all(
        this.currentPlayers.map(player => player.setPositionAsync(positionMs))
      );

      this.currentState.progress = position;
      this.notifyStateChange();

    } catch (error) {
      console.error('Error seeking:', error);
      this.callbacks.onError?.('Failed to seek');
    }
  }

  /**
   * Get current player state
   */
  public getState(): PlaylistPlayerState {
    return { ...this.currentState };
  }

  /**
   * Check if a playlist is currently loaded
   */
  public hasPlaylist(): boolean {
    return this.currentState.currentPlaylist !== null;
  }

  /**
   * Get current playlist
   */
  public getCurrentPlaylist(): Playlist | null {
    return this.currentState.currentPlaylist;
  }

  /**
   * Get current song
   */
  public getCurrentSong(): Song | null {
    return this.currentState.currentSong;
  }

  /**
   * Get current song index
   */
  public getCurrentSongIndex(): number {
    return this.currentState.currentSongIndex;
  }

  // Private methods

  private async loadCurrentSong(): Promise<void> {
    if (!this.currentState.currentSong) return;

    try {
      // Unload previous players
      await this.unloadCurrentSong();

      // Load new song tracks
      const audioStorage = AudioStorageService.getInstance();

      this.currentPlayers = await Promise.all(
        (this.currentState.currentSong.tracks || []).map(async (track) => {
          try {
            const audioFile = await audioStorage.getAudioFile(track.path);
            const sound = await audioStorage.loadAudioFile(audioFile);
            
            // Set up playback status listener
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded) {
                this.currentState.progress = (status.positionMillis || 0) / 1000;
                this.currentState.duration = (status.durationMillis || 0) / 1000;
                this.notifyStateChange();

                // Check if song finished
                if (status.didJustFinish) {
                  this.handleSongFinished();
                }
              }
            });

            return sound;
          } catch (error) {
            console.error(`Error loading track ${track.name}:`, error);
            throw error;
          }
        })
      );

      // Get duration from first track
      if (this.currentPlayers.length > 0) {
        const status = await this.currentPlayers[0].getStatusAsync();
        if (status.isLoaded) {
          this.currentState.duration = (status.durationMillis || 0) / 1000;
        }
      }

      this.notifyStateChange();

    } catch (error) {
      console.error('Error loading current song:', error);
      this.callbacks.onError?.('Failed to load song');
    }
  }

  private async unloadCurrentSong(): Promise<void> {
    try {
      await Promise.all(
        this.currentPlayers.map(player => player.unloadAsync())
      );
      this.currentPlayers = [];
    } catch (error) {
      console.error('Error unloading current song:', error);
    }
  }

  private async getCurrentPlaylistSongs(): Promise<Song[]> {
    if (!this.currentState.currentPlaylist) return [];

    try {
      const { songs } = await this.playlistService.getPlaylistSongs(this.currentState.currentPlaylist.id);
      return songs;
    } catch (error) {
      console.error('Error getting playlist songs:', error);
      return [];
    }
  }

  private getNextSongIndex(): number {
    if (!this.currentState.currentPlaylist) return -1;

    const songs = this.currentState.currentPlaylist.songs;
    if (songs.length === 0) return -1;

    if (this.currentState.isShuffled) {
      // Simple shuffle: pick random song that's not current
      const availableIndices = songs
        .map((_, index) => index)
        .filter(index => index !== this.currentState.currentSongIndex);
      
      if (availableIndices.length === 0) {
        return this.currentState.isRepeating ? 0 : -1;
      }

      return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    } else {
      // Sequential playback
      const nextIndex = this.currentState.currentSongIndex + 1;
      if (nextIndex >= songs.length) {
        return this.currentState.isRepeating ? 0 : -1;
      }
      return nextIndex;
    }
  }

  private getPreviousSongIndex(): number {
    if (!this.currentState.currentPlaylist) return -1;

    const songs = this.currentState.currentPlaylist.songs;
    if (songs.length === 0) return -1;

    if (this.currentState.isShuffled) {
      // In shuffle mode, previous goes to a random song
      const availableIndices = songs
        .map((_, index) => index)
        .filter(index => index !== this.currentState.currentSongIndex);
      
      if (availableIndices.length === 0) {
        return this.currentState.isRepeating ? songs.length - 1 : -1;
      }

      return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    } else {
      // Sequential playback
      const prevIndex = this.currentState.currentSongIndex - 1;
      if (prevIndex < 0) {
        return this.currentState.isRepeating ? songs.length - 1 : -1;
      }
      return prevIndex;
    }
  }

  private async handleSongFinished(): Promise<void> {
    if (this.currentState.isRepeating) {
      // Repeat current song
      await this.goToSong(this.currentState.currentSongIndex);
    } else {
      // Go to next song
      await this.next();
    }
  }

  private notifyStateChange(): void {
    this.callbacks.onStateChange?.(this.getState());
  }
}

export default PlaylistPlayerService;
