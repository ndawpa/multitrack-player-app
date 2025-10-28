import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, FlatList, TextInput, Animated, Easing, Alert, Clipboard, ActivityIndicator, Image, Linking, Dimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database } from '../config/firebase';
import AudioStorageService from '../services/audioStorage';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { User } from '../types/user';
import FavoritesService from '../services/favoritesService';
import PlaylistPlayerService from '../services/playlistPlayerService';
import PlaylistService from '../services/playlistService';
import TrackStateService, { TrackState, SongTrackStates } from '../services/trackStateService';
import { Playlist } from '../types/playlist';
import Header from '../components/Header';

// Custom ID generator
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
};

interface Track {
  id: string;
  name: string;
  path: string;  // Path in Firebase Storage
}

interface Score {
  id: string;
  name: string;
  url: string;
}

interface Resource {
  id: string;
  name: string;
  type: 'youtube' | 'download' | 'link' | 'pdf';
  url: string;
  description?: string;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  tracks?: Track[];  // Optional tracks field
  lyrics?: string;  // Optional lyrics field
  scores?: Score[];  // Array of scores instead of single score
  resources?: Resource[];  // Array of resources
}

// Add new interface for song creation
interface NewSongForm {
  title: string;
  artist: string;
  tracks: {
    id: string;
    name: string;
    file: DocumentPicker.DocumentPickerAsset | null;
  }[];
  lyrics: string;
  scores: Score[];
  resources: Resource[];
}

interface EditSongForm {
  id: string;
  title: string;
  artist: string;
  tracks: {
    id: string;
    name: string;
    path: string;
    file: DocumentPicker.DocumentPickerAsset | null;
  }[];
  lyrics?: string;
  scores: Score[];
  resources: Resource[];
}

interface SyncState {
  isPlaying: boolean;
  seekPosition: number;
  activeTracks: string[];
  soloedTracks: string[];
  trackVolumes: { [key: string]: number };
  playbackSpeed: number; // Add playback speed state
}

// Add helper functions before the HomePage component
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const MarqueeText = ({ text, style }: { text: string; style: any }) => {
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = React.useState(0);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (textWidth > containerWidth) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollX, {
            toValue: -(textWidth - containerWidth),
            duration: 5000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scrollX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [textWidth, containerWidth]);

  return (
    <View 
      style={[style, { overflow: 'hidden' }]} 
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        style={[
          style,
          {
            transform: [{ translateX: scrollX }],
            width: 'auto',
          },
        ]}
        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

interface HomePageProps {
  onNavigateToProfile: () => void;
  onNavigateToPlaylists?: (songs: Song[]) => void;
  user: User | null;
  playlistToPlay?: {playlist: Playlist, songs: Song[]} | null;
  onPlaylistPlayed?: () => void;
  isAdminMode?: boolean;
  onAdminModeChange?: (isAdmin: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigateToProfile, onNavigateToPlaylists, user, playlistToPlay, onPlaylistPlayed, isAdminMode: propIsAdminMode, onAdminModeChange }) => {
  const insets = useSafeAreaInsets();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [players, setPlayers] = useState<Audio.Sound[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIds, setActiveTrackIds] = useState<string[]>([]);
  const [soloedTrackIds, setSoloedTrackIds] = useState<string[]>([]);
  const [trackProgress, setTrackProgress] = useState<{ [key: string]: number }>({});
  const [trackDurations, setTrackDurations] = useState<{ [key: string]: number }>({});
  const [trackVolumes, setTrackVolumes] = useState<{ [key: string]: number }>({});
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [expandedLyricsIds, setExpandedLyricsIds] = useState<Set<string>>(new Set());
  const [isSessionMenuExpanded, setIsSessionMenuExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [expandedScores, setExpandedScores] = useState<{ [key: string]: boolean }>({});
  const [expandedResources, setExpandedResources] = useState<{ [key: string]: boolean }>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Add playback speed state
  
  // Playlist state
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [isPlaylistMode, setIsPlaylistMode] = useState(false);
  // Playlist player removed - using main audio system
  
  // Add to playlist state
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [playlistService] = useState(() => PlaylistService.getInstance());
  
  // Track state persistence
  const [trackStateService] = useState(() => TrackStateService.getInstance());
  const [persistedTrackStates, setPersistedTrackStates] = useState<SongTrackStates>({});
  const [isLoadingTrackStates, setIsLoadingTrackStates] = useState(false);
  
  // Track click detection state
  const [trackClickTimers, setTrackClickTimers] = useState<{ [key: string]: ReturnType<typeof setTimeout> | null }>({});
  
  // Full-screen image state
  const [fullScreenImage, setFullScreenImage] = useState<{ url: string; name: string } | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageTranslateX, setImageTranslateX] = useState(0);
  const [imageTranslateY, setImageTranslateY] = useState(0);
  
  // Sync state
  const [deviceId] = useState(() => generateId());
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isPlaying: false,
    seekPosition: 0,
    activeTracks: [],
    soloedTracks: [],
    trackVolumes: {},
    playbackSpeed: 1.0
  });
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [latency, setLatency] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const SYNC_THRESHOLD = 100;
  const [showSessionIdDialog, setShowSessionIdDialog] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState<{ [key: string]: boolean }>({});
  const [activeSessions, setActiveSessions] = useState<{ id: string; admin: string; createdAt: number }[]>([]);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [showAddSongDialog, setShowAddSongDialog] = useState(false);
  const [newSong, setNewSong] = useState<NewSongForm>({
    title: '',
    artist: '',
    tracks: [],
    lyrics: '',
    scores: [],
    resources: []
  });
  const [showEditSongDialog, setShowEditSongDialog] = useState(false);
  const [editingSong, setEditingSong] = useState<EditSongForm | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(propIsAdminMode || false);
  const [password, setPassword] = useState('');
  const ADMIN_PASSWORD = 'admin123'; // You should change this to a more secure password

  // Sync local admin mode state with prop
  useEffect(() => {
    if (propIsAdminMode !== undefined) {
      setIsAdminMode(propIsAdminMode);
    }
  }, [propIsAdminMode]);
  
  // Song operation password protection states
  const [showSongPasswordDialog, setShowSongPasswordDialog] = useState(false);
  const [songPassword, setSongPassword] = useState('');
  const [songPasswordError, setSongPasswordError] = useState('');
  const [pendingSongOperation, setPendingSongOperation] = useState<'admin' | null>(null);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'tracks' | 'lyrics' | 'sheetMusic' | 'score' | 'resources'>('tracks');
  const [isLyricsEditing, setIsLyricsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [showArtistFilterDialog, setShowArtistFilterDialog] = useState(false);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  
  // Screen orientation state
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const isLandscape = screenData.width > screenData.height;

  // Favorites state
  const [favoriteSongs, setFavoriteSongs] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesService] = useState(() => FavoritesService.getInstance());
  
  // Content filter states
  const [showContentFilterDialog, setShowContentFilterDialog] = useState(false);
  const [hasTracks, setHasTracks] = useState(false);
  const [hasLyrics, setHasLyrics] = useState(false);
  const [hasScores, setHasScores] = useState(false);
  const [hasLinks, setHasLinks] = useState(false);

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [showRecordingControls, setShowRecordingControls] = useState(false);
  const [recordingName, setRecordingName] = useState('Voice Recording');

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });
    return () => subscription?.remove();
  }, []);

  // Load songs from Firebase
  useEffect(() => {
    const songsRef = ref(database, 'songs');
    const unsubscribe = onValue(songsRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Firebase songs data:', data);
      if (data) {
        const songsList = Object.entries(data).map(([id, songData]: [string, any]) => ({
          id,
          ...songData
        }));
        console.log('Processed songs list:', songsList);
        setSongs(songsList);
      } else {
        console.log('No songs data in Firebase');
        setSongs([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user's favorite songs with real-time sync
  useEffect(() => {
    if (!user) {
      setFavoriteSongs(new Set());
      return;
    }

    const userRef = ref(database, `users/${user.id}/stats/favoriteSongs`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const favorites = snapshot.val() || [];
      setFavoriteSongs(new Set(favorites));
    }, (error) => {
      console.error('Error listening to favorites:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Set current user in TrackStateService
  useEffect(() => {
    trackStateService.setCurrentUser(user?.id || null);
  }, [user, trackStateService]);

  // Apply persisted track states when they change
  useEffect(() => {
    console.log('Track state effect triggered:', {
      hasPersistedStates: Object.keys(persistedTrackStates).length > 0,
      hasSelectedSong: !!selectedSong,
      isInitialized,
      playersLength: players.length,
      persistedTrackStates
    });
    
    if (Object.keys(persistedTrackStates).length > 0 && selectedSong && isInitialized && players.length > 0) {
      console.log('Applying persisted track states:', persistedTrackStates);
      
      // Apply volume states
      const newVolumes: { [key: string]: number } = {};
      const newSoloedTracks: string[] = [];
      const newActiveTracks: string[] = [];
      
      Object.entries(persistedTrackStates).forEach(([trackId, trackState]) => {
        newVolumes[trackId] = trackState.volume;
        if (trackState.solo) {
          newSoloedTracks.push(trackId);
        }
        if (!trackState.mute) {
          newActiveTracks.push(trackId);
        }
      });
      
      setTrackVolumes(newVolumes);
      setSoloedTrackIds(newSoloedTracks);
      setActiveTrackIds(newActiveTracks);
      
      // Apply volume to players with proper solo/mute logic
      const applyTrackStates = async () => {
        for (let index = 0; index < players.length; index++) {
          const player = players[index];
          const track = selectedSong.tracks?.[index];
          
          if (track && persistedTrackStates[track.id]) {
            const trackState = persistedTrackStates[track.id];
            const isTrackSoloed = trackState.solo;
            const isTrackMuted = trackState.mute;
            
            // Determine if this track should play
            let shouldPlay = false;
            let volumeToSet = 0;
            
            if (newSoloedTracks.length === 0) {
              // No solo tracks - play all non-muted tracks
              shouldPlay = !isTrackMuted;
              volumeToSet = shouldPlay ? trackState.volume : 0;
            } else {
              // Some tracks are soloed - only play soloed tracks
              shouldPlay = isTrackSoloed && !isTrackMuted;
              volumeToSet = shouldPlay ? trackState.volume : 0;
            }
            
            console.log(`Applying state to track ${track.id}:`, {
              solo: isTrackSoloed,
              mute: isTrackMuted,
              volume: trackState.volume,
              shouldPlay,
              volumeToSet
            });
            
            await player.setVolumeAsync(volumeToSet);
          }
        }
      };
      
      // Apply states with a small delay to ensure players are ready
      setTimeout(applyTrackStates, 100);
    }
  }, [persistedTrackStates, selectedSong, isInitialized, players]);

  // Real-time sync for track states
  useEffect(() => {
    if (!user || !selectedSong) return;

    console.log('Setting up real-time listener for track states:', selectedSong.id);
    const unsubscribe = trackStateService.listenToSongTrackStates(
      selectedSong.id,
      (trackStates) => {
        if (trackStates) {
          console.log('Received real-time track state update:', trackStates);
          setPersistedTrackStates(trackStates);
        }
      }
    );

    return () => {
      console.log('Cleaning up real-time listener for track states');
      unsubscribe();
    };
  }, [user, selectedSong, trackStateService]);

  // Cleanup TrackStateService on unmount
  useEffect(() => {
    return () => {
      trackStateService.cleanup();
    };
  }, [trackStateService]);

  // Initialize sync session
  const initializeSyncSession = async () => {
    const newSessionId = generateId();
    setSessionId(newSessionId);
    setIsAdmin(true);
    
    // Create session in Firebase
    const sessionRef = ref(database, `sessions/${newSessionId}`);
    await set(sessionRef, {
      admin: deviceId,
      createdAt: serverTimestamp(),
      state: {
        isPlaying: false,
        seekPosition: 0,
        activeTracks: [],
        soloedTracks: [],
        trackVolumes: {},
        playbackSpeed: 1.0
      }
    });
  };

  // Join existing session
  const joinSession = async (sessionId: string) => {
    try {
      setSessionId(sessionId);
      setIsAdmin(false);
      
      // Initialize sync state with default values
      setSyncState({
        isPlaying: false,
        seekPosition: 0,
        activeTracks: [],
        soloedTracks: [],
        trackVolumes: {},
        playbackSpeed: 1.0
      });
    } catch (error) {
      console.error('Error joining session:', error);
    }
  };

  // Listen for sync state changes
  useEffect(() => {
    if (!sessionId) return;

    const sessionRef = ref(database, `sessions/${sessionId}/state`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSyncState({
          isPlaying: data.isPlaying || false,
          seekPosition: data.seekPosition || 0,
          activeTracks: data.activeTracks || [],
          soloedTracks: data.soloedTracks || [],
          trackVolumes: data.trackVolumes || {},
          playbackSpeed: data.playbackSpeed || 1.0
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  // Modify the togglePlayback function
  const togglePlayback = async () => {
    if (!isInitialized || !selectedSong) {
      console.log('Cannot toggle playback:', { isInitialized, selectedSong });
      return;
    }

    try {
      if (isPlaying) {
        if (sessionId) {
          if (isAdmin) {
            // Update sync state
            const sessionRef = ref(database, `sessions/${sessionId}/state`);
            await set(sessionRef, {
              isPlaying: false,
              seekPosition,
              activeTracks: [],
              soloedTracks: [],
              trackVolumes: {},
              playbackSpeed: 1.0
            });
          }
        }
        await stopLocalPlayback();
      } else {
        if (sessionId) {
          if (isAdmin) {
            // Update sync state
            const sessionRef = ref(database, `sessions/${sessionId}/state`);
            await set(sessionRef, {
              isPlaying: true,
              seekPosition,
              activeTracks: [],
              soloedTracks: [],
              trackVolumes: {},
              playbackSpeed: 1.0
            });
          }
        }
        await startLocalPlayback();
      }
    } catch (error) {
      console.error('Error in togglePlayback:', error);
    }
  };

  // Apply sync state changes (non-admin devices)
  useEffect(() => {
    if (isAdmin || !syncState || !selectedSong) return;

    const now = Date.now();
    if (now - lastSyncTime < SYNC_THRESHOLD) return;
    setLastSyncTime(now);

    // Handle play/pause state
    if (syncState.isPlaying !== isPlaying) {
      if (syncState.isPlaying) {
        startLocalPlayback();
      } else {
        stopLocalPlayback();
      }
    }

    // Update seek position
    if (selectedSong.tracks && selectedSong.tracks.length > 0 && Math.abs(syncState.seekPosition - seekPosition) > 0.1) {
      handleSeek(selectedSong.tracks![0].id, syncState.seekPosition);
    }
  }, [syncState, isAdmin, selectedSong]);

  // Function to start local playback
  const startLocalPlayback = async () => {
    if (!selectedSong || !isInitialized) {
      console.log('Cannot start local playback:', { selectedSong, isInitialized });
      return;
    }

    try {
      console.log('Starting local playback');
      setIsFinished(false);
      setTrackProgress({});
      
      const playPromises = players.map(async (player, index) => {
        if (selectedSong.tracks && selectedSong.tracks[index] && activeTrackIds.includes(selectedSong.tracks[index].id)) {
          console.log(`Starting track ${selectedSong.tracks[index].name}`);
          const status = await player.getStatusAsync();
          if (status.isLoaded) {
            await player.setPositionAsync(seekPosition * 1000);
            await player.setRateAsync(playbackSpeed, true);
            await player.playAsync();
            console.log(`Track ${selectedSong.tracks[index].name} started successfully`);
          } else {
            console.error(`Track ${selectedSong.tracks[index].name} not loaded`);
          }
        }
      });
      await Promise.all(playPromises);
      setIsPlaying(true);
      console.log('Local playback started successfully');
    } catch (error) {
      console.error('Error starting local playback:', error);
    }
  };

  // Function to stop local playback
  const stopLocalPlayback = async () => {
    if (!selectedSong || !isInitialized) return;

    try {
      console.log('Stopping local playback');
      await Promise.all(players.map(player => player.pauseAsync()));
      setIsPlaying(false);
      console.log('Local playback stopped successfully');
    } catch (error) {
      console.error('Error stopping local playback:', error);
    }
  };

  // Optimize progress updates
  useEffect(() => {
    const progressInterval = setInterval(async () => {
      if (isPlaying && !isSeeking && selectedSong) {
        let allFinished = true;
        let hasActiveTracks = false;
        
        for (let i = 0; i < players.length; i++) {
          const status = await players[i].getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            const position = status.positionMillis / 1000;
            const duration = status.durationMillis / 1000;
            
            if (selectedSong.tracks && selectedSong.tracks[i] && activeTrackIds.includes(selectedSong.tracks[i].id)) {
              hasActiveTracks = true;
              setTrackProgress(prev => ({
                ...prev,
                [selectedSong.tracks![i].id]: position
              }));
              setSeekPosition(position);
              
              if (position < duration) {
                allFinished = false;
              }
            }
          }
        }
        
        if (hasActiveTracks && allFinished && !isFinished) {
          console.log('Song finished playing');
          setIsFinished(true);
          setIsPlaying(false);
          
          // If repeat is enabled, restart the song
          if (isRepeat) {
            handleRestart();
          } else if (isPlaylistMode && currentPlaylist && playlistSongs.length > 0) {
            // Auto-advance to next song in playlist
            const nextIndex = currentPlaylistIndex + 1;
            const nextSong = playlistSongs[nextIndex];
            
            if (nextIndex < playlistSongs.length) {
              // Go to next song
              const nextSong = playlistSongs[nextIndex];
              setCurrentPlaylistIndex(nextIndex);
              setSelectedSong(nextSong);
              // Reset finished state and initialize players for the new song
              setIsFinished(false);
              // Stop current playback and progress tracking
              setIsPlaying(false);
              // Reset initialization state for new song
              setIsInitialized(false);
              // Small delay to ensure proper cleanup before loading new song
              setTimeout(() => {
                handleSongSelect(nextSong);
              }, 100);
            } else if (isPlaylistRepeating) {
              // Restart playlist from beginning
              const firstSong = playlistSongs[0];
              setCurrentPlaylistIndex(0);
              setSelectedSong(firstSong);
              setIsFinished(false);
              setIsPlaying(false);
              setIsInitialized(false);
              setLastAutoStartedSong(null);
              
              setTimeout(() => {
                handleSongSelect(firstSong);
              }, 100);
            } else {
              // Playlist finished
              setIsPlaylistMode(false);
              setCurrentPlaylist(null);
              setPlaylistSongs([]);
              setCurrentPlaylistIndex(0);
              Alert.alert('Playlist Complete', 'All songs in the playlist have been played');
            }
          }
        }
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized, selectedSong, isFinished, activeTrackIds, isRepeat, isPlaylistMode, currentPlaylist, playlistSongs, currentPlaylistIndex]);

  // Optimize handleSeek function
  const handleSeek = async (trackId: string, value: number) => {
    if (!isInitialized || !selectedSong || !players.length) return;

    setIsSeeking(true);
    setSeekPosition(value);
    
    try {
      // Use Promise.all for parallel seeking with better error handling
      await Promise.all(
        players.map(async (player) => {
          try {
            const status = await player.getStatusAsync();
            if (status.isLoaded) {
              await player.setPositionAsync(value * 1000);
            }
          } catch (playerError) {
            // Silently handle individual player errors during song transitions
            console.log('Player not available for seeking (likely during song transition)');
          }
        })
      );

      setTrackProgress(prev => {
        const newProgress = { ...prev };
        selectedSong.tracks?.forEach(track => {
          newProgress[track.id] = value;
        });
        return newProgress;
      });
    } catch (error) {
      // Only log errors that aren't related to song transitions
      if (!(error instanceof Error) || !error.message?.includes('sound is not loaded')) {
        console.error('Error seeking:', error);
      }
    } finally {
      setIsSeeking(false);
    }
  };

  // Initialize players when a song is selected
  useEffect(() => {
    const initializePlayers = async () => {
      if (!selectedSong) return;

      try {
        console.log('Initializing audio players');
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        // Set all tracks as loading initially
        const initialLoadingState = (selectedSong.tracks || []).reduce((acc, track) => ({
          ...acc,
          [track.id]: true
        }), {});
        setLoadingTracks(initialLoadingState);

        // Unload previous players
        await Promise.all(players.map(player => player.unloadAsync()));

        const audioStorage = AudioStorageService.getInstance();
        const loadedPlayers = await Promise.all(
          (selectedSong.tracks || []).map(async (track) => {
            console.log(`Loading track: ${track.name}`);
            try {
              const audioFile = await audioStorage.getAudioFile(track.path);
              const sound = await audioStorage.loadAudioFile(audioFile);
              
              setLoadingTracks(prev => ({
                ...prev,
                [track.id]: false
              }));
              
              return sound;
            } catch (error) {
              console.error(`Error loading track ${track.name}:`, error);
              setLoadingTracks(prev => ({
                ...prev,
                [track.id]: false
              }));
              throw error;
            }
          })
        );

        console.log('All players loaded successfully');
        setPlayers(loadedPlayers);
        setIsInitialized(true);
        setSeekPosition(0);

        // Initialize volumes with default values (will be overridden by persisted states if available)
        const initialVolumes = (selectedSong.tracks || []).reduce((acc, track) => ({
          ...acc,
          [track.id]: 1
        }), {});
        setTrackVolumes(initialVolumes);
        
        // Set all tracks as active by default (will be overridden by persisted states if available)
        const initialActiveTracks = (selectedSong.tracks || []).map(track => track.id);
        setActiveTrackIds(initialActiveTracks);

        // Get durations
        loadedPlayers.forEach(async (player, index) => {
          const status = await player.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            if (selectedSong.tracks && selectedSong.tracks[index]) {
              setTrackDurations(prev => ({
                ...prev,
                [selectedSong.tracks![index].id]: status.durationMillis! / 1000
              }));
            }
          }
        });

        // Set all tracks as active initially
        setActiveTrackIds((selectedSong.tracks || []).map(track => track.id));
        setSoloedTrackIds([]);
        setTrackProgress({});
      } catch (error) {
        console.error('Error initializing players:', error);
      }
    };

    initializePlayers();

    return () => {
      players.forEach(player => {
        player.unloadAsync();
      });
    };
  }, [selectedSong]);

  const handleSongSelect = async (song: Song) => {
    setIsPlaying(false);
    setSelectedSong(song);
    
    // Reset track states for new song
    setPersistedTrackStates({});
    setSoloedTrackIds([]);
    setActiveTrackIds([]);
    setTrackVolumes({});
    
    // Load persisted track states for this song
    if (user) {
      setIsLoadingTrackStates(true);
      try {
        const trackStates = await trackStateService.loadSongTrackStates(song.id);
        if (trackStates) {
          setPersistedTrackStates(trackStates);
          console.log('Loaded track states for song:', song.id, trackStates);
        } else {
          // Initialize with default states if none exist
          const trackIds = song.tracks?.map(track => track.id) || [];
          const defaultStates = await trackStateService.initializeSongTrackStates(song.id, trackIds);
          setPersistedTrackStates(defaultStates);
          console.log('Initialized default track states for song:', song.id);
        }
      } catch (error) {
        console.error('Error loading track states:', error);
        setPersistedTrackStates({});
      } finally {
        setIsLoadingTrackStates(false);
      }
    }
  };

  const handleToggleFavorite = async (songId: string, event: any) => {
    event.stopPropagation(); // Prevent song selection when clicking favorite button
    
    try {
      const isNowFavorite = await favoritesService.toggleFavorite(songId);
      
      // Note: Local state update is no longer needed since we have real-time sync
      // The real-time listener will automatically update the state when Firebase changes
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert(
        'Error',
        'Failed to update favorites. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredSongs = useMemo(() => {
    console.log('Current songs state:', songs);
    let filtered = songs;
    
    // Apply artist filter if selected
    if (selectedArtists.size > 0) {
      filtered = filtered.filter(song => selectedArtists.has(song.artist));
    }
    
    // Apply favorites filter if enabled
    if (showFavoritesOnly) {
      filtered = filtered.filter(song => favoriteSongs.has(song.id));
    }
    
    // Apply content filters
    if (hasTracks) {
      filtered = filtered.filter(song => song.tracks && song.tracks.length > 0);
    }
    
    if (hasLyrics) {
      filtered = filtered.filter(song => song.lyrics && song.lyrics.trim().length > 0);
    }
    
    if (hasScores) {
      filtered = filtered.filter(song => song.scores && song.scores.length > 0);
    }
    
    if (hasLinks) {
      filtered = filtered.filter(song => song.resources && song.resources.length > 0);
    }
    
    // Apply search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered
        .map(song => {
          const titleMatch = song.title.toLowerCase().includes(query);
          const artistMatch = song.artist.toLowerCase().includes(query);
          const lyricsMatch = song.lyrics && song.lyrics.toLowerCase().includes(query);
          
          // Calculate match priority (higher number = higher priority)
          let priority = 0;
          if (titleMatch) priority += 3;
          if (artistMatch) priority += 2;
          if (lyricsMatch) priority += 1;
          
          return {
            ...song,
            matchInfo: {
              titleMatch,
              artistMatch,
              lyricsMatch,
              priority
            }
          };
        })
        .filter(song => song.matchInfo.priority > 0)
        .sort((a, b) => b.matchInfo.priority - a.matchInfo.priority);
    }
    
    // Sort songs by title
    filtered = [...filtered].sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      return sortOrder === 'asc' 
        ? titleA.localeCompare(titleB)
        : titleB.localeCompare(titleA);
    });
    
    console.log('Filtered songs:', filtered);
    return filtered;
  }, [searchQuery, selectedArtists, songs, sortOrder, showFavoritesOnly, favoriteSongs, hasTracks, hasLyrics, hasScores, hasLinks]);

  // Get unique artists for the filter dropdown
  const uniqueArtists = useMemo(() => {
    const artists = new Set(songs.map(song => song.artist));
    return Array.from(artists).sort();
  }, [songs]);

  const toggleArtistSelection = (artist: string) => {
    setSelectedArtists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artist)) {
        newSet.delete(artist);
      } else {
        newSet.add(artist);
      }
      return newSet;
    });
  };

  // Content filter helper functions
  const clearContentFilters = () => {
    setHasTracks(false);
    setHasLyrics(false);
    setHasScores(false);
    setHasLinks(false);
  };

  const hasActiveContentFilters = () => {
    return hasTracks || hasLyrics || hasScores || hasLinks;
  };

  // Artist filter helper functions
  const clearArtistFilters = () => {
    setSelectedArtists(new Set());
  };

  const renderSongItem = ({ item }: { item: Song & { matchInfo?: { titleMatch: boolean; artistMatch: boolean; lyricsMatch: boolean } } }) => {
    const searchTerm = searchQuery.toLowerCase().trim();
    const hasLyricsMatch = item.lyrics && item.lyrics.toLowerCase().includes(searchTerm);
    const isExpanded = expandedLyricsIds.has(item.id);
    
    // Function to get all lyrics snippets with context
    const getAllLyricsSnippets = () => {
      if (!item.lyrics || !searchTerm) return [];
      
      const lyrics = item.lyrics.toLowerCase();
      const snippets = [];
      let startIndex = 0;
      
      while (true) {
        const termIndex = lyrics.indexOf(searchTerm, startIndex);
        if (termIndex === -1) break;
        
        // Get 30 characters before and after the term
        const start = Math.max(0, termIndex - 30);
        const end = Math.min(lyrics.length, termIndex + searchTerm.length + 30);
        
        let snippet = item.lyrics.slice(start, end);
        
        // Add ellipsis if we're not at the start/end
        if (start > 0) snippet = '...' + snippet;
        if (end < item.lyrics.length) snippet = snippet + '...';
        
        // Highlight the search term
        const termStart = snippet.toLowerCase().indexOf(searchTerm);
        if (termStart !== -1) {
          const beforeTerm = snippet.slice(0, termStart);
          const term = snippet.slice(termStart, termStart + searchTerm.length);
          const afterTerm = snippet.slice(termStart + searchTerm.length);
          
          snippets.push(
            <Text key={termIndex} style={styles.lyricsSnippet}>
              {beforeTerm}
              <Text style={styles.highlightedTerm}>{term}</Text>
              {afterTerm}
            </Text>
          );
        }
        
        startIndex = termIndex + searchTerm.length;
      }
      
      return snippets;
    };
    
    const snippets = getAllLyricsSnippets();
    const hasMultipleMatches = snippets.length > 1;
    
    return (
      <TouchableOpacity
        style={[
          styles.songItem,
          selectedSong?.id === item.id && styles.selectedSongItem
        ]}
        onPress={() => handleSongSelect(item)}
      >
        {/* Content indicators - positioned in top-right corner */}
        <View style={styles.contentIndicators}>
          {item.tracks && item.tracks.length > 0 && (
            <View style={styles.contentIndicator}>
              <Ionicons name="musical-notes" size={8} color="#BB86FC" />
            </View>
          )}
          {item.lyrics && item.lyrics.trim() && (
            <View style={styles.contentIndicator}>
              <Ionicons name="document-text" size={8} color="#BB86FC" />
            </View>
          )}
          {item.scores && item.scores.length > 0 && (
            <View style={styles.contentIndicator}>
              <Ionicons name="musical-note" size={8} color="#BB86FC" />
            </View>
          )}
          {item.resources && item.resources.length > 0 && (
            <View style={styles.contentIndicator}>
              <Ionicons name="link" size={8} color="#BB86FC" />
            </View>
          )}
        </View>

        <View style={styles.songInfo}>
          <View style={styles.titleContainer}>
            <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
            {item.matchInfo?.titleMatch && (
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>Title</Text>
              </View>
            )}
          </View>
          <View style={styles.artistContainer}>
            <Text style={styles.songArtist} numberOfLines={1} ellipsizeMode="tail">{item.artist}</Text>
            {item.matchInfo?.artistMatch && (
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>Artist</Text>
              </View>
            )}
          </View>
          {searchTerm && hasLyricsMatch && (
            <View style={styles.matchIndicator}>
              <View style={styles.lyricsHeader}>
                <View style={styles.lyricsTitleContainer}>
                  <Ionicons name="document-text" size={14} color="#BB86FC" />
                  <Text style={styles.matchText}>
                    Found in lyrics ({snippets.length} matches)
                  </Text>
                </View>
              </View>
              <View style={styles.snippetsContainer}>
                {isExpanded ? (
                  snippets
                ) : (
                  snippets.slice(0, 1)
                )}
                {hasMultipleMatches && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => toggleLyricsExpansion(item.id)}
                  >
                    <Text style={styles.expandButtonText}>
                      {isExpanded ? 'Show less' : `Show ${snippets.length - 1} more`}
                    </Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#BB86FC"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.songActions}>
          {isAdminMode && (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => startEditingSong(item)}
              >
                <Ionicons name="create-outline" size={24} color="#BB86FC" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  setSongToDelete(item);
                  setShowDeleteConfirmDialog(true);
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#FF5252" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(event) => handleToggleFavorite(item.id, event)}
          >
            <Ionicons 
              name={favoriteSongs.has(item.id) ? "star" : "star-outline"} 
              size={24} 
              color={favoriteSongs.has(item.id) ? "#BB86FC" : "#BBBBBB"} 
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderJoinDialog = () => (
    <KeyboardAvoidingView 
      style={styles.dialogOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Join Session</Text>
        <TextInput
          style={styles.dialogInput}
          placeholder="Enter Session ID"
          placeholderTextColor="#666666"
          value={joinSessionInput}
          onChangeText={setJoinSessionInput}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        <View style={styles.dialogButtonContainer}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonSecondary]}
            onPress={() => setShowJoinDialog(false)}
          >
            <Text style={styles.dialogButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonPrimary]}
            onPress={() => {
              if (joinSessionInput.trim()) {
                joinSession(joinSessionInput.trim());
                setShowJoinDialog(false);
                setJoinSessionInput('');
              }
            }}
          >
            <Text style={[styles.dialogButtonText, { flexShrink: 1 }]}>Create Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderSessionIdDialog = () => (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Session ID</Text>
        <View style={styles.sessionIdDialogContent}>
          <Text style={styles.sessionIdLabel}>Share this ID with others:</Text>
          <Text style={styles.fullSessionId}>{sessionId}</Text>
        </View>
        <View style={styles.dialogButtonContainer}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonSecondary]}
            onPress={() => setShowSessionIdDialog(false)}
          >
            <Text style={styles.dialogButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonPrimary]}
            onPress={async () => {
              try {
                await Clipboard.setString(sessionId || '');
                Alert.alert('Success', 'Session ID copied to clipboard');
              } catch (error) {
                Alert.alert('Error', 'Failed to copy session ID');
              }
            }}
          >
            <Text style={styles.dialogButtonText}>Copy ID</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Add back the track control functions
  const toggleSolo = async (trackId: string) => {
    if (!isInitialized || !selectedSong) return;

    const trackIndex = selectedSong.tracks?.findIndex(t => t.id === trackId) ?? -1;
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    const isSoloed = soloedTrackIds.includes(trackId);
    let newSoloedTrackIds: string[];

    if (isSoloed) {
      newSoloedTrackIds = soloedTrackIds.filter(id => id !== trackId);
    } else {
      newSoloedTrackIds = [...soloedTrackIds, trackId];
    }
    setSoloedTrackIds(newSoloedTrackIds);

    selectedSong.tracks?.forEach(async (track, index) => {
      const isActive = activeTrackIds.includes(track.id);
      if (newSoloedTrackIds.length === 0) {
        await players[index].setVolumeAsync(isActive ? (trackVolumes[track.id] || 1) : 0);
      } else {
        await players[index].setVolumeAsync(
          newSoloedTrackIds.includes(track.id) ? (trackVolumes[track.id] || 1) : 0
        );
      }
    });

    // Persist the solo state
    if (user) {
      try {
        const currentTrackState = persistedTrackStates[trackId] || trackStateService.getDefaultTrackState();
        const updatedTrackState = { ...currentTrackState, solo: !isSoloed };
        await trackStateService.saveTrackState(selectedSong.id, trackId, updatedTrackState);
        
        // Update local persisted state
        setPersistedTrackStates(prev => ({
          ...prev,
          [trackId]: updatedTrackState
        }));
      } catch (error) {
        console.error('Error saving solo state:', error);
      }
    }
  };

  const handleVolumeChange = async (trackId: string, value: number) => {
    if (!isInitialized || !selectedSong) return;

    const trackIndex = selectedSong.tracks?.findIndex(t => t.id === trackId) ?? -1;
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    setTrackVolumes(prev => ({
      ...prev,
      [trackId]: value
    }));

    if (soloedTrackIds.includes(trackId) || soloedTrackIds.length === 0) {
      await player.setVolumeAsync(value);
    }

    // Persist the volume state
    if (user) {
      try {
        const currentTrackState = persistedTrackStates[trackId] || trackStateService.getDefaultTrackState();
        const updatedTrackState = { ...currentTrackState, volume: value };
        await trackStateService.saveTrackState(selectedSong.id, trackId, updatedTrackState);
        
        // Update local persisted state
        setPersistedTrackStates(prev => ({
          ...prev,
          [trackId]: updatedTrackState
        }));
      } catch (error) {
        console.error('Error saving volume state:', error);
      }
    }
  };

  const toggleTrack = async (trackId: string) => {
    if (!isInitialized || !selectedSong) return;

    const trackIndex = selectedSong.tracks?.findIndex(t => t.id === trackId) ?? -1;
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    const isActive = activeTrackIds.includes(trackId);

    if (isActive) {
      setActiveTrackIds(prev => prev.filter(id => id !== trackId));
      if (!soloedTrackIds.includes(trackId)) {
        await player.setVolumeAsync(0);
      }
    } else {
      setActiveTrackIds(prev => [...prev, trackId]);
      if (soloedTrackIds.length === 0 || soloedTrackIds.includes(trackId)) {
        const volume = trackVolumes[trackId] || 1;
        await player.setVolumeAsync(volume);
      }
    }

    // Persist the mute state
    if (user) {
      try {
        const currentTrackState = persistedTrackStates[trackId] || trackStateService.getDefaultTrackState();
        const updatedTrackState = { ...currentTrackState, mute: isActive };
        await trackStateService.saveTrackState(selectedSong.id, trackId, updatedTrackState);
        
        // Update local persisted state
        setPersistedTrackStates(prev => ({
          ...prev,
          [trackId]: updatedTrackState
        }));
      } catch (error) {
        console.error('Error saving mute state:', error);
      }
    }
  };

  const handleTrackClick = (trackId: string) => {
    const existingTimer = trackClickTimers[trackId];
    
    if (existingTimer) {
      // This is a double click - clear the timer and mute the track
      clearTimeout(existingTimer);
      setTrackClickTimers(prev => ({
        ...prev,
        [trackId]: null
      }));
      toggleTrack(trackId); // Mute/unmute
    } else {
      // This is a single click - set a timer and solo the track
      const timer = setTimeout(() => {
        // Single click timeout - solo the track
        toggleSolo(trackId);
        setTrackClickTimers(prev => ({
          ...prev,
          [trackId]: null
        }));
      }, 300); // 300ms delay to detect double clicks
      
      setTrackClickTimers(prev => ({
        ...prev,
        [trackId]: timer
      }));
    }
  };

  const leaveSession = async () => {
    try {
      if (isAdmin) {
        // If admin, delete the session from Firebase
        const sessionRef = ref(database, `sessions/${sessionId}`);
        await set(sessionRef, null);
      }
      // Reset session-related state
      setSessionId(null);
      setIsAdmin(false);
      setSyncState({
        isPlaying: false,
        seekPosition: 0,
        activeTracks: [],
        soloedTracks: [],
        trackVolumes: {},
        playbackSpeed: 1.0
      });
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  };

  // Add function to fetch active sessions
  useEffect(() => {
    if (showSessionsList) {
      const sessionsRef = ref(database, 'sessions');
      const unsubscribe = onValue(sessionsRef, (snapshot) => {
        const sessions = snapshot.val();
        if (sessions) {
          const sessionsList = Object.entries(sessions).map(([id, data]: [string, any]) => ({
            id,
            admin: data.admin,
            createdAt: data.createdAt
          }));
          setActiveSessions(sessionsList);
        } else {
          setActiveSessions([]);
        }
      });

      return () => unsubscribe();
    }
  }, [showSessionsList]);

  // Playlist player is no longer needed - using main audio system

  // Handle playlist playback when playlistToPlay is provided
  useEffect(() => {
    if (playlistToPlay) {
      const startPlaylistPlayback = async () => {
        try {
          // Load the first song from the playlist using the main audio system
          const firstSong = playlistToPlay.songs[0];
          if (firstSong) {
            setSelectedSong(firstSong);
            setCurrentPlaylist(playlistToPlay.playlist);
            setPlaylistSongs(playlistToPlay.songs);
            setCurrentPlaylistIndex(0);
            setIsPlaylistMode(true);
            
            // Load and play the song using the existing audio system
            handleSongSelect(firstSong);
            onPlaylistPlayed?.(); // Clear the playlist data
          }
        } catch (error) {
          console.error('Error starting playlist playback:', error);
          Alert.alert('Error', 'Failed to start playlist playback');
        }
      };

      startPlaylistPlayback();
    }
  }, [playlistToPlay, onPlaylistPlayed]);

  // Auto-start playback when players are initialized in playlist mode (only for new songs)
  const [lastAutoStartedSong, setLastAutoStartedSong] = useState<string | null>(null);
  const [isPlaylistRepeating, setIsPlaylistRepeating] = useState(false);
  const [showPlaylistSongsModal, setShowPlaylistSongsModal] = useState(false);
  
  useEffect(() => {
    if (isInitialized && isPlaylistMode && selectedSong && !isPlaying && selectedSong.id !== lastAutoStartedSong) {
      console.log('Auto-starting playlist playback for new song:', { isInitialized, isPlaylistMode, selectedSong: selectedSong.title, isPlaying });
      setLastAutoStartedSong(selectedSong.id);
      
      const startPlayback = async () => {
        try {
          console.log('Calling startLocalPlayback...');
          await startLocalPlayback();
          console.log('startLocalPlayback completed successfully');
        } catch (error) {
          console.error('Error auto-starting playlist playback:', error);
        }
      };
      
      // Small delay to ensure everything is ready
      setTimeout(startPlayback, 200);
    }
  }, [isInitialized, isPlaylistMode, selectedSong, isPlaying, lastAutoStartedSong]);

  const deleteSession = async (sessionIdToDelete: string) => {
    try {
      const sessionRef = ref(database, `sessions/${sessionIdToDelete}`);
      await set(sessionRef, null);
      // If we're currently in the session being deleted, leave it
      if (sessionId === sessionIdToDelete) {
        await leaveSession();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const renderSessionsList = () => (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Active Sessions</Text>
        {activeSessions.length === 0 ? (
          <Text style={styles.dialogText}>No active sessions</Text>
        ) : (
          <ScrollView style={styles.sessionsList}>
            {activeSessions.map(session => (
              <View key={session.id} style={styles.sessionItem}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionItemId}>ID: {session.id}</Text>
                  <Text style={styles.sessionItemAdmin}>Admin: {session.admin}</Text>
                  <Text style={styles.sessionDate}>
                    Created: {new Date(session.createdAt).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.sessionActions, { flexWrap: 'wrap', gap: 8 }]}>
                  <TouchableOpacity
                    style={[styles.dialogButton, styles.dialogButtonPrimary, { flex: 1, minWidth: 100 }]}
                    onPress={() => {
                      setShowSessionsList(false);
                      joinSession(session.id);
                    }}
                  >
                    <Text style={styles.dialogButtonText}>Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dialogButton, styles.dialogButtonDelete, { flex: 1, minWidth: 100 }]}
                    onPress={() => deleteSession(session.id)}
                  >
                    <Text style={styles.dialogButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={[styles.dialogButtonContainer, { justifyContent: 'center' }]}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonSecondary, { minWidth: 200 }]}
            onPress={() => setShowSessionsList(false)}
          >
            <Text style={styles.dialogButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Modify the join button press handler
  const handleJoinPress = () => {
    setShowSessionsList(true);
  };

  const renderSongList = () => (
    <View style={styles.songListContainer}>
      {/* App Title Header */}
      <View style={styles.appTitleContainer}>
        <Text style={styles.appTitle}>Kit de Voz</Text>
      </View>
      
      {isSessionMenuExpanded && (
        <View style={styles.sessionMenuContent}>
          {sessionId ? (
            <View style={styles.activeSessionInfo}>
              <View style={styles.sessionIdContainer}>
                <Text style={styles.sessionIdLabel}>Session ID:</Text>
                <TouchableOpacity 
                  onPress={() => setShowSessionIdDialog(true)}
                  style={styles.sessionIdButtonMain}
                >
                  <Text style={styles.sessionIdText} numberOfLines={1}>
                    {sessionId.substring(0, 8)}...
                  </Text>
                </TouchableOpacity>
                {isAdmin && (
                  <Text style={styles.adminBadge}>Admin</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.leaveButton}
                onPress={leaveSession}
              >
                <Ionicons name="exit-outline" size={20} color="#FF5252" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.sessionMenuButtons}>
              <TouchableOpacity 
                style={[styles.sessionMenuButton, styles.adminButton]}
                onPress={async () => {
                  try {
                    await initializeSyncSession();
                    setShowSessionIdDialog(true);
                  } catch (error) {
                    Alert.alert('Error', 'Failed to create session. Please try again.');
                  }
                }}
              >
                <Ionicons name="people" size={24} color="#FFFFFF" />
                <Text style={styles.sessionMenuButtonText}>Create Session</Text>
                <Text style={styles.sessionMenuButtonSubtext}>Become an admin</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sessionMenuButton, styles.clientButton]}
                onPress={handleJoinPress}
              >
                <Ionicons name="enter" size={24} color="#FFFFFF" />
                <Text style={styles.sessionMenuButtonText}>Join Session</Text>
                <Text style={styles.sessionMenuButtonSubtext}>Join as client</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <View style={styles.searchAndFilterContainer}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#BBBBBB" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.searchRightActions}>
            {searchQuery ? (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close-circle" size={20} color="#BBBBBB" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.integratedActionButton, selectedArtists.size > 0 && styles.integratedActiveButton]}
              onPress={() => {
                setShowArtistFilterDialog(true);
              }}
            >
              <Ionicons 
                name="filter" 
                size={16} 
                color={selectedArtists.size > 0 ? "#FFFFFF" : "#BBBBBB"} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.integratedActionButton, hasActiveContentFilters() && styles.integratedActiveButton]}
              onPress={() => {
                setShowContentFilterDialog(true);
              }}
            >
              <Ionicons 
                name="layers-outline" 
                size={16} 
                color={hasActiveContentFilters() ? "#FFFFFF" : "#BBBBBB"} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.integratedActionButton, sortOrder === 'desc' && styles.integratedActiveButton]}
              onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              <Ionicons 
                name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color={sortOrder === 'desc' ? "#FFFFFF" : "#BBBBBB"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {isAdminMode && (
        <TouchableOpacity 
          style={styles.addSongButton}
          onPress={() => setShowAddSongDialog(true)}
        >
          <Ionicons name="add-circle" size={24} color="#BB86FC" />
          <Text style={styles.addSongButtonText}>Add New Song</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={filteredSongs}
        renderItem={renderSongItem}
        keyExtractor={item => item.id}
        style={styles.songList}
        showsVerticalScrollIndicator={false}
      />
      {showArtistFilterDialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>Filter by Artists</Text>
            <ScrollView style={styles.dialogScrollView}>
              {uniqueArtists.map(artist => (
                <TouchableOpacity
                  key={artist}
                  style={styles.artistFilterOption}
                  onPress={() => toggleArtistSelection(artist)}
                >
                  <View style={styles.artistFilterOptionContent}>
                    <Ionicons 
                      name={selectedArtists.has(artist) ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={selectedArtists.has(artist) ? "#BB86FC" : "#BBBBBB"} 
                    />
                    <Text style={[
                      styles.artistFilterOptionText,
                      selectedArtists.has(artist) && styles.artistFilterOptionTextSelected
                    ]}>{artist}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.dialogButtonContainer, { justifyContent: 'space-between' }]}>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={clearArtistFilters}
              >
                <Text style={styles.dialogButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={() => setShowArtistFilterDialog(false)}
              >
                <Text style={styles.dialogButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {showContentFilterDialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>Filter by Content</Text>
            <ScrollView style={styles.dialogScrollView}>
              <TouchableOpacity
                style={styles.artistFilterOption}
                onPress={() => setHasTracks(!hasTracks)}
              >
                <View style={styles.artistFilterOptionContent}>
                  <Ionicons 
                    name={hasTracks ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={hasTracks ? "#BB86FC" : "#BBBBBB"} 
                  />
                  <Ionicons name="musical-notes-outline" size={20} color="#BB86FC" style={styles.filterIcon} />
                  <Text style={[
                    styles.artistFilterOptionText,
                    hasTracks && styles.artistFilterOptionTextSelected
                  ]}>Tracks</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.artistFilterOption}
                onPress={() => setHasLyrics(!hasLyrics)}
              >
                <View style={styles.artistFilterOptionContent}>
                  <Ionicons 
                    name={hasLyrics ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={hasLyrics ? "#BB86FC" : "#BBBBBB"} 
                  />
                  <Ionicons name="text-outline" size={20} color="#BB86FC" style={styles.filterIcon} />
                  <Text style={[
                    styles.artistFilterOptionText,
                    hasLyrics && styles.artistFilterOptionTextSelected
                  ]}>Lyrics</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.artistFilterOption}
                onPress={() => setHasScores(!hasScores)}
              >
                <View style={styles.artistFilterOptionContent}>
                  <Ionicons 
                    name={hasScores ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={hasScores ? "#BB86FC" : "#BBBBBB"} 
                  />
                  <Ionicons name="musical-note-outline" size={20} color="#BB86FC" style={styles.filterIcon} />
                  <Text style={[
                    styles.artistFilterOptionText,
                    hasScores && styles.artistFilterOptionTextSelected
                  ]}>Scores</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.artistFilterOption}
                onPress={() => setHasLinks(!hasLinks)}
              >
                <View style={styles.artistFilterOptionContent}>
                  <Ionicons 
                    name={hasLinks ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={hasLinks ? "#BB86FC" : "#BBBBBB"} 
                  />
                  <Ionicons name="link-outline" size={20} color="#BB86FC" style={styles.filterIcon} />
                  <Text style={[
                    styles.artistFilterOptionText,
                    hasLinks && styles.artistFilterOptionTextSelected
                  ]}>Links</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.dialogButtonContainer, { justifyContent: 'space-between' }]}>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={clearContentFilters}
              >
                <Text style={styles.dialogButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={() => setShowContentFilterDialog(false)}
              >
                <Text style={styles.dialogButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  // Add function to start editing a song
  const startEditingSong = (song: Song) => {
    setEditingSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      tracks: (song.tracks || []).map(track => ({
        ...track,
        file: null
      })),
      lyrics: song.lyrics,
      scores: song.scores || [],
      resources: song.resources || []
    });
    setShowEditSongDialog(true);
  };

  // Add function to add a new track to existing song
  const addNewTrackToSong = () => {
    if (!editingSong) return;
    setEditingSong(prev => ({
      ...prev!,
      tracks: [
        ...prev!.tracks,
        {
          id: generateId(),
          name: '',
          path: '',
          file: null
        }
      ]
    }));
  };

  // Add function to remove a track from existing song
  const removeTrackFromSong = async (trackId: string) => {
    if (!editingSong) return;

    try {
      // Find the track to be removed
      const trackToRemove = editingSong.tracks.find(track => track.id === trackId);
      if (trackToRemove && trackToRemove.path) {
        try {
          // Delete the file from Firebase Storage
          await AudioStorageService.getInstance().deleteAudioFile(trackToRemove.path);
        } catch (error) {
          console.warn('Failed to delete file from storage:', error);
          // Continue with track removal even if file deletion fails
        }
      }

      // Update the editing song state
      setEditingSong(prev => ({
        ...prev!,
        tracks: prev!.tracks.filter(track => track.id !== trackId)
      }));
    } catch (error) {
      console.error('Error removing track:', error);
      Alert.alert('Error', 'Failed to remove track. Please try again.');
    }
  };

  // Add function to update track name in existing song
  const updateTrackNameInSong = (trackId: string, name: string) => {
    if (!editingSong) return;
    setEditingSong(prev => ({
      ...prev!,
      tracks: prev!.tracks.map(track => 
        track.id === trackId ? { ...track, name } : track
      )
    }));
  };

  // Add function to handle song editing
  const handleEditSong = async () => {
    try {
      if (!editingSong) return;

      if (!editingSong.title.trim() || !editingSong.artist.trim()) {
        throw new Error('Please enter song title and artist');
      }


      // Create folder name from title
      const folderName = editingSong.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Upload new files and update tracks
      const updatedTracks = await Promise.all(
        editingSong.tracks.map(async (track, index) => {
          if (!track.name.trim()) {
            throw new Error(`Please enter a name for track ${index + 1}`);
          }

          let path = track.path;
          
          // If there's a new file, upload it
          if (track.file) {
            path = `audio/${folderName}/${editingSong.title} - ${track.name}.mp3`;
            await AudioStorageService.getInstance().uploadAudioFile(track.file, path);
          }
          
          return {
            id: track.id,
            name: track.name,
            path
          };
        })
      );

      // Create song data object with explicit values
      const songData = {
        title: editingSong.title,
        artist: editingSong.artist,
        tracks: updatedTracks,
        lyrics: editingSong.lyrics || '',
        scores: editingSong.scores || [],
        resources: editingSong.resources || []
      };

      // Update song in Firebase
      const songRef = ref(database, `songs/${editingSong.id}`);
      await set(songRef, songData);

      // Reset and close dialog
      setEditingSong(null);
      setShowEditSongDialog(false);
    } catch (error) {
      console.error('Error editing song:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to edit song');
    }
  };

  // Add render function for the edit song dialog
  const renderEditSongDialog = () => {
    if (!editingSong) return null;

    return (
      <KeyboardAvoidingView 
        style={styles.dialogOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.dialogContainer}>
          <ScrollView style={styles.dialogScrollView}>
            <Text style={styles.dialogTitle}>Edit Song</Text>
            
            <TextInput
              style={styles.dialogInput}
              placeholder="Song Title"
              placeholderTextColor="#666666"
              value={editingSong.title}
              onChangeText={(text) => setEditingSong(prev => prev ? { ...prev, title: text } : null)}
            />
            
            <TextInput
              style={styles.dialogInput}
              placeholder="Artist"
              placeholderTextColor="#666666"
              value={editingSong.artist}
              onChangeText={(text) => setEditingSong(prev => prev ? { ...prev, artist: text } : null)}
            />
            
            <View style={styles.tracksHeader}>
              <Text style={styles.tracksTitle}>Tracks</Text>
              <TouchableOpacity
                style={styles.addTrackButton}
                onPress={addMultipleTracksToSong}
              >
                <Ionicons name="add-circle" size={24} color="#BB86FC" />
                <Text style={styles.addTrackButtonText}>Add Tracks</Text>
              </TouchableOpacity>
            </View>

            {editingSong.tracks.map((track, index) => (
              <View key={track.id} style={styles.trackUploadContainer}>
                <View style={styles.trackHeader}>
                  <TextInput
                    style={[styles.trackNameInput, { flex: 1 }]}
                    placeholder={`Track ${index + 1} Name`}
                    placeholderTextColor="#666666"
                    value={track.name}
                    onChangeText={(text) => updateTrackNameInSong(track.id, text)}
                  />
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={async () => {
                      try {
                        const result = await AudioStorageService.getInstance().pickAudioFile();
                        if (result) {
                          setEditingSong(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              tracks: prev.tracks.map((t) => 
                                t.id === track.id ? { ...t, file: result } : t
                              )
                            };
                          });
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to pick audio file');
                      }
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => removeTrackFromSong(track.id)}
                  >
                    <Ionicons name="trash-outline" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
                {track.file ? (
                  <View style={styles.fileNameContainer}>
                    <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                      {track.file.name}
                    </Text>
                  </View>
                ) : track.path ? (
                  <View style={styles.fileNameContainer}>
                    <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                      Current: {track.path.split('/').pop()}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.uploadPrompt}>Tap upload to select audio file</Text>
                )}
              </View>
            ))}
            
            <View style={styles.lyricsSection}>
              <View style={styles.lyricsHeader}>
                <Text style={styles.sectionTitle}>Lyrics</Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={uploadLyricsFromFile}
                >
                  <Text style={styles.uploadButtonText}>Upload from File</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.dialogInput, styles.lyricsInput]}
                placeholder="Enter lyrics..."
                placeholderTextColor="#666666"
                value={editingSong.lyrics}
                onChangeText={(text) => setEditingSong(prev => prev ? { ...prev, lyrics: text } : null)}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            
            <View style={styles.lyricsSection}>
              <Text style={styles.sectionTitle}>Sheet Music</Text>
              <View style={styles.scoreList}>
                {editingSong.scores.map((score, index) => (
                  <View key={score.id} style={styles.scoreItem}>
                    <TextInput
                      style={[styles.dialogInput, { flex: 1 }]}
                      placeholder="Score Name"
                      placeholderTextColor="#666666"
                      value={score.name}
                      onChangeText={(text) => {
                        setEditingSong(prev => {
                          if (!prev) return null;
                          const newScores = [...prev.scores];
                          newScores[index] = { ...newScores[index], name: text };
                          return { ...prev, scores: newScores };
                        });
                      }}
                    />
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => {
                        setEditingSong(prev => {
                          if (!prev) return null;
                          const newScores = prev.scores.filter((_, i) => i !== index);
                          return { ...prev, scores: newScores };
                        });
                      }}
                    >
                      <Ionicons name="trash-outline" size={24} color="#FF5252" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: ['application/pdf', 'image/*'],
                      copyToCacheDirectory: true
                    });
                    
                    if (result.assets && result.assets[0]) {
                      const file = result.assets[0];
                      const scoreName = file.name.split('.')[0];
                      
                      // Show loading state
                      setEditingSong(prev => {
                        if (!prev) return null;
                        const newScore: Score = {
                          id: generateId(),
                          name: scoreName,
                          url: 'uploading'
                        };
                        return {
                          ...prev,
                          scores: [...prev.scores, newScore]
                        };
                      });

                      // Upload to Firebase Storage
                      const downloadURL = await uploadSheetMusic(file, scoreName, editingSong.title);
                      
                      // Update the score with the download URL
                      setEditingSong(prev => {
                        if (!prev) return null;
                        const newScores = prev.scores.map(score => 
                          score.url === 'uploading' ? { ...score, url: downloadURL } : score
                        );
                        return { ...prev, scores: newScores };
                      });
                    }
                  } catch (error) {
                    console.error('Error uploading score:', error);
                    Alert.alert('Error', 'Failed to upload score');
                    // Reset the uploading score
                    setEditingSong(prev => {
                      if (!prev) return null;
                      const newScores = prev.scores.filter(score => score.url !== 'uploading');
                      return { ...prev, scores: newScores };
                    });
                  }
                }}
              >
                <Text style={styles.uploadButtonText}>Add Score</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.lyricsSection}>
              <Text style={styles.sectionTitle}>Links</Text>
              <View style={styles.scoreList}>
                {editingSong.resources.map((resource, index) => (
                  <View key={resource.id} style={styles.resourceItemContainer}>
                    <TextInput
                      style={[styles.dialogInput, { flex: 1 }]}
                      placeholder="Link Name"
                      placeholderTextColor="#666666"
                      value={resource.name}
                      onChangeText={(text) => {
                        setEditingSong(prev => {
                          if (!prev) return null;
                          const newResources = [...prev.resources];
                          newResources[index] = { ...newResources[index], name: text };
                          return { ...prev, resources: newResources };
                        });
                      }}
                    />
                    <View style={styles.resourceTypeContainer}>
                      <Text style={styles.resourceTypeLabel}>Type:</Text>
                      <View style={styles.resourceTypeButtons}>
                        {['youtube', 'download', 'link', 'pdf'].map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.resourceTypeButton,
                              resource.type === type && styles.resourceTypeButtonActive
                            ]}
                            onPress={() => {
                              setEditingSong(prev => {
                                if (!prev) return null;
                                const newResources = [...prev.resources];
                                newResources[index] = { ...newResources[index], type: type as any };
                                return { ...prev, resources: newResources };
                              });
                            }}
                          >
                            <Text style={[
                              styles.resourceTypeButtonText,
                              resource.type === type && styles.resourceTypeButtonTextActive
                            ]}>
                              {type === 'youtube' ? 'Video' : type === 'pdf' ? 'PDF' : type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TextInput
                      style={[styles.dialogInput, { flex: 1 }]}
                      placeholder="URL"
                      placeholderTextColor="#666666"
                      value={resource.url}
                      onChangeText={(text) => {
                        setEditingSong(prev => {
                          if (!prev) return null;
                          const newResources = [...prev.resources];
                          newResources[index] = { ...newResources[index], url: text };
                          return { ...prev, resources: newResources };
                        });
                      }}
                    />
                    <TextInput
                      style={[styles.dialogInput, { flex: 1 }]}
                      placeholder="Description (optional)"
                      placeholderTextColor="#666666"
                      value={resource.description || ''}
                      onChangeText={(text) => {
                        setEditingSong(prev => {
                          if (!prev) return null;
                          const newResources = [...prev.resources];
                          newResources[index] = { ...newResources[index], description: text };
                          return { ...prev, resources: newResources };
                        });
                      }}
                    />
                    <View style={styles.centeredTrashButton}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => {
                          setEditingSong(prev => {
                            if (!prev) return null;
                            const newResources = prev.resources.filter((_, i) => i !== index);
                            return { ...prev, resources: newResources };
                          });
                        }}
                      >
                        <Ionicons name="trash-outline" size={24} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => {
                  setEditingSong(prev => {
                    if (!prev) return null;
                    const newResource: Resource = {
                      id: generateId(),
                      name: '',
                      type: 'link',
                      url: '',
                      description: ''
                    };
                    return {
                      ...prev,
                      resources: [...prev.resources, newResource]
                    };
                  });
                }}
              >
                <Text style={styles.uploadButtonText}>Add Link</Text>
              </TouchableOpacity>
            </View>

            {/* Rest of the dialog content */}
          </ScrollView>
          <View style={styles.dialogButtonContainer}>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonSecondary]}
              onPress={() => {
                setEditingSong(null);
                setShowEditSongDialog(false);
              }}
            >
              <Text style={styles.dialogButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonPrimary]}
              onPress={handleEditSong}
            >
              <Text style={[styles.dialogButtonText, { flexShrink: 1 }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  // Add function to handle song deletion
  const handleDeleteSong = async () => {
    if (!songToDelete) return;

    try {
      // Delete all audio files from Firebase Storage
      await Promise.all(
        (songToDelete.tracks || []).map(async (track) => {
          try {
            await AudioStorageService.getInstance().deleteAudioFile(track.path);
          } catch (error) {
            console.warn(`Failed to delete file ${track.path}:`, error);
          }
        })
      );

      // Remove song from Firebase
      const songRef = ref(database, `songs/${songToDelete.id}`);
      await set(songRef, null);

      // Reset state and close dialog
      setSongToDelete(null);
      setShowDeleteConfirmDialog(false);

      // If the deleted song was selected, clear the selection
      if (selectedSong?.id === songToDelete.id) {
        setSelectedSong(null);
      }
    } catch (error) {
      console.error('Error deleting song:', error);
      Alert.alert('Error', 'Failed to delete song. Please try again.');
    }
  };

  // Add render function for delete confirmation dialog
  const renderDeleteConfirmDialog = () => {
    if (!songToDelete) return null;

    return (
      <View style={styles.dialogOverlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Delete Song</Text>
          <Text style={styles.dialogText}>
            Are you sure you want to delete "{songToDelete.title}"? This action cannot be undone.
          </Text>
          <View style={styles.dialogButtonContainer}>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonSecondary]}
              onPress={() => {
                setSongToDelete(null);
                setShowDeleteConfirmDialog(false);
              }}
            >
              <Text style={styles.dialogButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonDelete]}
              onPress={handleDeleteSong}
            >
              <Text style={styles.dialogButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Add function to handle password verification
  const handlePasswordVerification = () => {
    if (password === ADMIN_PASSWORD) {
      setShowPasswordDialog(false);
      setIsAdminMode(true);
      onAdminModeChange?.(true);
      setPassword('');
    } else {
      Alert.alert('Error', 'Incorrect password');
      setPassword('');
    }
  };

  // Song operation password verification
  const handleSongPasswordSubmit = () => {
    if (songPassword === ADMIN_PASSWORD) {
      setShowSongPasswordDialog(false);
      setSongPassword('');
      setSongPasswordError('');
      
      // Execute the pending operation
      if (pendingSongOperation === 'admin') {
        setIsAdminMode(true);
        onAdminModeChange?.(true);
      }
      
      setPendingSongOperation(null);
    } else {
      setSongPasswordError('Incorrect password. Please try again.');
      setSongPassword('');
    }
  };

  const handleSongPasswordCancel = () => {
    setShowSongPasswordDialog(false);
    setSongPassword('');
    setSongPasswordError('');
    setPendingSongOperation(null);
  };

  // Add render function for password dialog
  const renderPasswordDialog = () => (
    <Modal
      visible={showPasswordDialog}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowPasswordDialog(false);
        setPassword('');
      }}
    >
      <KeyboardAvoidingView 
        style={styles.passwordDialogOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.passwordDialog}>
          <Text style={styles.dialogTitle}>Enter Password</Text>
          <TextInput
            style={styles.dialogInput}
            placeholder="Password"
            placeholderTextColor="#666666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />
          <View style={styles.dialogButtonContainer}>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonSecondary]}
              onPress={() => {
                setShowPasswordDialog(false);
                setPassword('');
              }}
            >
              <Text style={styles.dialogButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.dialogButton, styles.dialogButtonPrimary]}
              onPress={handlePasswordVerification}
            >
              <Text style={styles.dialogButtonText}>Verify</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Song operation password dialog
  const renderSongPasswordDialog = () => (
    <Modal
      visible={showSongPasswordDialog}
      transparent={true}
      animationType="fade"
      onRequestClose={handleSongPasswordCancel}
    >
      <View style={styles.songPasswordModalContainer}>
        <View style={styles.songPasswordModal}>
          <View style={styles.songPasswordHeader}>
            <Ionicons name="lock-closed" size={32} color="#BB86FC" />
            <Text style={styles.songPasswordTitle}>Admin Mode</Text>
            <Text style={styles.songPasswordSubtitle}>Enter password to access</Text>
          </View>
          
          <View style={styles.songPasswordContent}>
            <TextInput
              style={styles.songPasswordInput}
              value={songPassword}
              onChangeText={setSongPassword}
              placeholder="Enter password"
              placeholderTextColor="#666"
              secureTextEntry
              autoFocus
              onSubmitEditing={handleSongPasswordSubmit}
            />
            
            {songPasswordError ? (
              <Text style={styles.songPasswordError}>{songPasswordError}</Text>
            ) : null}
            
            <View style={styles.songPasswordButtons}>
              <TouchableOpacity
                style={styles.songPasswordCancelButton}
                onPress={handleSongPasswordCancel}
              >
                <Text style={styles.songPasswordCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.songPasswordSubmitButton}
                onPress={handleSongPasswordSubmit}
              >
                <Text style={styles.songPasswordSubmitText}>Enter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Add this function after other utility functions
  const uploadSheetMusic = async (file: DocumentPicker.DocumentPickerAsset, fileName: string, songTitle: string): Promise<string> => {
    try {
      const storage = getStorage();
      const fileExtension = file.name.split('.').pop();
      // Create a safe version of the song title for the file name
      const safeSongTitle = songTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filePath = `sheet_music/${safeSongTitle}_${fileName}.${fileExtension}`;
      const fileRef = storageRef(storage, filePath);

      // Fetch the file and convert to blob
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      await uploadBytes(fileRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(fileRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading sheet music:', error);
      throw new Error('Failed to upload sheet music');
    }
  };

  // Add this function after other utility functions
  const logSheetMusicInfo = (url: string) => {
    console.log('Sheet Music URL:', url);
    console.log('Is PDF:', url.endsWith('.pdf'));
    console.log('File extension:', url.split('.').pop());
  };

  // Add function to add a new track
  const addNewTrack = () => {
    setNewSong(prev => ({
      ...prev,
      tracks: [
        ...prev.tracks,
        {
          id: generateId(),
          name: '',
          file: null
        }
      ]
    }));
  };

  // Add function to remove a track
  const removeTrack = (trackId: string) => {
    setNewSong(prev => ({
      ...prev,
      tracks: prev.tracks.filter(track => track.id !== trackId)
    }));
  };

  // Add function to update track name
  const updateTrackName = (trackId: string, name: string) => {
    setNewSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(track => 
        track.id === trackId ? { ...track, name } : track
      )
    }));
  };

  // Modify handleAddSong to use custom track names
  const handleAddSong = async () => {
    try {
      if (!newSong.title.trim() || !newSong.artist.trim()) {
        throw new Error('Please enter song title and artist');
      }


      // Generate a new ID
      const newId = generateId();
      
      // Create folder name from title
      const folderName = newSong.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Upload files and create tracks (only if files are provided)
      const tracks = await Promise.all(
        newSong.tracks
          .filter(track => track.file) // Only process tracks that have files
          .map(async (track, index) => {
            if (!track.name.trim()) {
              throw new Error(`Please enter a name for track ${index + 1}`);
            }
            
            // Upload file to Firebase Storage
            const filePath = `audio/${folderName}/${newSong.title} - ${track.name}.mp3`;
            await AudioStorageService.getInstance().uploadAudioFile(track.file!, filePath);
            
            return {
              id: `${newId}-${index + 1}`,
              name: track.name,
              path: filePath
            };
          })
      );

      // Create new song object
      const songToAdd: Song = {
        id: newId,
        title: newSong.title,
        artist: newSong.artist,
        tracks,
        lyrics: newSong.lyrics,
        scores: newSong.scores,
        resources: newSong.resources
      };

      // Add to Firebase
      const songRef = ref(database, `songs/${newId}`);
      await set(songRef, {
        title: songToAdd.title,
        artist: songToAdd.artist,
        tracks: songToAdd.tracks,
        lyrics: songToAdd.lyrics,
        scores: songToAdd.scores,
        resources: songToAdd.resources
      });

      // Reset form and close dialog
      setNewSong({
        title: '',
        artist: '',
        tracks: [],
        lyrics: '',
        scores: [],
        resources: []
      });
      setShowAddSongDialog(false);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  // Add function to add multiple tracks at once
  const addMultipleTracks = async () => {
    try {
      const files = await AudioStorageService.getInstance().pickMultipleAudioFiles();
      if (files.length > 0) {
        setNewSong(prev => ({
          ...prev,
          tracks: [
            ...prev.tracks,
            ...files.map(file => ({
              id: generateId(),
              name: file.name.split('.')[0], // Use filename without extension as initial name
              file: file
            }))
          ]
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio files');
    }
  };

  const addMultipleTracksToSong = async () => {
    try {
      const files = await AudioStorageService.getInstance().pickMultipleAudioFiles();
      if (files.length > 0) {
        setEditingSong(prev => {
          if (!prev) return null;
          return {
            ...prev,
            tracks: [
              ...prev.tracks,
              ...files.map(file => ({
                id: generateId(),
                name: file.name.split('.')[0], // Use filename without extension as initial name
                path: '', // Will be set when uploaded
                file: file
              }))
            ]
          };
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick audio files');
    }
  };

  // Modify renderAddSongDialog to use the new multiple track selection
  const renderAddSongDialog = () => (
    <KeyboardAvoidingView 
      style={styles.dialogOverlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.dialog, { maxHeight: '80%' }]}>
        <Text style={styles.dialogTitle}>Add New Song</Text>
        <ScrollView style={styles.addSongForm}>
          <TextInput
            style={styles.dialogInput}
            placeholder="Song Title"
            placeholderTextColor="#666666"
            value={newSong.title}
            onChangeText={(text) => setNewSong(prev => ({ ...prev, title: text }))}
          />
          <TextInput
            style={styles.dialogInput}
            placeholder="Artist"
            placeholderTextColor="#666666"
            value={newSong.artist}
            onChangeText={(text) => setNewSong(prev => ({ ...prev, artist: text }))}
          />
          
          <View style={styles.tracksHeader}>
            <Text style={styles.tracksTitle}>Tracks</Text>
            <TouchableOpacity
              style={styles.addTrackButton}
              onPress={addMultipleTracks}
            >
              <Ionicons name="add-circle" size={24} color="#BB86FC" />
              <Text style={styles.addTrackButtonText}>Add Tracks</Text>
            </TouchableOpacity>
          </View>

          {newSong.tracks.map((track, index) => (
            <View key={track.id} style={styles.trackUploadContainer}>
              <View style={styles.trackHeader}>
                <TextInput
                  style={[styles.trackNameInput, { flex: 1 }]}
                  placeholder={`Track ${index + 1} Name`}
                  placeholderTextColor="#666666"
                  value={track.name}
                  onChangeText={(text) => updateTrackName(track.id, text)}
                />
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={async () => {
                    try {
                      const result = await AudioStorageService.getInstance().pickAudioFile();
                      if (result) {
                        setNewSong(prev => ({
                          ...prev,
                          tracks: prev.tracks.map((t) => 
                            t.id === track.id ? { ...t, file: result } : t
                          )
                        }));
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to pick audio file');
                    }
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => removeTrack(track.id)}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>
              {track.file ? (
                <View style={styles.fileNameContainer}>
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {track.file.name}
                  </Text>
                </View>
              ) : (
                <Text style={styles.uploadPrompt}>Tap upload to select audio file</Text>
              )}
            </View>
          ))}
          
          <View style={styles.lyricsSection}>
            <View style={styles.lyricsHeader}>
              <Text style={styles.sectionTitle}>Lyrics</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={uploadLyricsFromFile}
              >
                <Text style={styles.uploadButtonText}>Upload from File</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.dialogInput, styles.lyricsInput]}
              placeholder="Enter lyrics..."
              placeholderTextColor="#666666"
              value={newSong.lyrics}
              onChangeText={(text) => setNewSong(prev => ({ ...prev, lyrics: text }))}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
          
          <View style={styles.lyricsSection}>
            <Text style={styles.sectionTitle}>Sheet Music</Text>
            <View style={styles.scoreList}>
              {newSong.scores.map((score, index) => (
                <View key={score.id} style={styles.scoreItem}>
                  <TextInput
                    style={[styles.dialogInput, { flex: 1 }]}
                    placeholder="Score Name"
                    placeholderTextColor="#666666"
                    value={score.name}
                    onChangeText={(text) => {
                      setNewSong(prev => {
                        const newScores = [...prev.scores];
                        newScores[index] = { ...newScores[index], name: text };
                        return { ...prev, scores: newScores };
                      });
                    }}
                  />
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => {
                      setNewSong(prev => {
                        const newScores = prev.scores.filter((_, i) => i !== index);
                        return { ...prev, scores: newScores };
                      });
                    }}
                  >
                    <Ionicons name="trash-outline" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={async () => {
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'image/*'],
                    copyToCacheDirectory: true
                  });
                  
                  if (result.assets && result.assets[0]) {
                    const file = result.assets[0];
                    const scoreName = file.name.split('.')[0];
                    
                    // Show loading state
                    setNewSong(prev => {
                      const newScore: Score = {
                        id: generateId(),
                        name: scoreName,
                        url: 'uploading'
                      };
                      return {
                        ...prev,
                        scores: [...prev.scores, newScore]
                      };
                    });

                    // Upload to Firebase Storage
                    const downloadURL = await uploadSheetMusic(file, scoreName, newSong.title);
                    
                    // Update the score with the download URL
                    setNewSong(prev => {
                      const newScores = prev.scores.map(score => 
                        score.url === 'uploading' ? { ...score, url: downloadURL } : score
                      );
                      return { ...prev, scores: newScores };
                    });
                  }
                } catch (error) {
                  console.error('Error uploading score:', error);
                  Alert.alert('Error', 'Failed to upload score');
                  // Reset the uploading score
                  setNewSong(prev => {
                    const newScores = prev.scores.filter(score => score.url !== 'uploading');
                    return { ...prev, scores: newScores };
                  });
                }
              }}
            >
              <Text style={styles.uploadButtonText}>Add Score</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.lyricsSection}>
            <Text style={styles.sectionTitle}>Links</Text>
            <View style={styles.scoreList}>
              {newSong.resources.map((resource, index) => (
                <View key={resource.id} style={styles.resourceItemContainer}>
                  <TextInput
                    style={[styles.dialogInput, { flex: 1 }]}
                    placeholder="Link Name"
                    placeholderTextColor="#666666"
                    value={resource.name}
                    onChangeText={(text) => {
                      setNewSong(prev => {
                        const newResources = [...prev.resources];
                        newResources[index] = { ...newResources[index], name: text };
                        return { ...prev, resources: newResources };
                      });
                    }}
                  />
                  <View style={styles.resourceTypeContainer}>
                    <Text style={styles.resourceTypeLabel}>Type:</Text>
                    <View style={styles.resourceTypeButtons}>
                      {['youtube', 'download', 'link', 'pdf'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.resourceTypeButton,
                            resource.type === type && styles.resourceTypeButtonActive
                          ]}
                          onPress={() => {
                            setNewSong(prev => {
                              const newResources = [...prev.resources];
                              newResources[index] = { ...newResources[index], type: type as any };
                              return { ...prev, resources: newResources };
                            });
                          }}
                        >
                          <Text style={[
                            styles.resourceTypeButtonText,
                            resource.type === type && styles.resourceTypeButtonTextActive
                          ]}>
                            {type === 'youtube' ? 'Video' : type === 'pdf' ? 'PDF' : type.charAt(0).toUpperCase() + type.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TextInput
                    style={[styles.dialogInput, { flex: 1 }]}
                    placeholder="URL"
                    placeholderTextColor="#666666"
                    value={resource.url}
                    onChangeText={(text) => {
                      setNewSong(prev => {
                        const newResources = [...prev.resources];
                        newResources[index] = { ...newResources[index], url: text };
                        return { ...prev, resources: newResources };
                      });
                    }}
                  />
                  <TextInput
                    style={[styles.dialogInput, { flex: 1 }]}
                    placeholder="Description (optional)"
                    placeholderTextColor="#666666"
                    value={resource.description || ''}
                    onChangeText={(text) => {
                      setNewSong(prev => {
                        const newResources = [...prev.resources];
                        newResources[index] = { ...newResources[index], description: text };
                        return { ...prev, resources: newResources };
                      });
                    }}
                  />
                  <View style={styles.centeredTrashButton}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => {
                        setNewSong(prev => {
                          const newResources = prev.resources.filter((_, i) => i !== index);
                          return { ...prev, resources: newResources };
                        });
                      }}
                    >
                      <Ionicons name="trash-outline" size={24} color="#FF5252" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => {
                setNewSong(prev => {
                  const newResource: Resource = {
                    id: generateId(),
                    name: '',
                    type: 'link',
                    url: '',
                    description: ''
                  };
                  return {
                    ...prev,
                    resources: [...prev.resources, newResource]
                  };
                });
              }}
            >
              <Text style={styles.uploadButtonText}>Add Link</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <View style={styles.dialogButtonContainer}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonSecondary]}
            onPress={() => setShowAddSongDialog(false)}
          >
            <Text style={styles.dialogButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonPrimary]}
            onPress={handleAddSong}
          >
            <Text style={styles.dialogButtonText}>Add Song</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  // Add this function after other utility functions
  const handleLyricsSave = async () => {
    if (!selectedSong) return;

    try {
      // Update song in Firebase
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, {
        ...selectedSong,
        lyrics: editedLyrics
      });

      // Update local state
      setSelectedSong(prev => prev ? { ...prev, lyrics: editedLyrics } : null);
      setIsLyricsEditing(false);
    } catch (error) {
      console.error('Error saving lyrics:', error);
      Alert.alert('Error', 'Failed to save lyrics. Please try again.');
    }
  };

  // Add this function after other utility functions
  const startLyricsEditing = () => {
    setEditedLyrics(selectedSong?.lyrics || '');
    setIsLyricsEditing(true);
  };

  // Add this function before renderSongView
  const toggleScoreExpansion = (scoreId: string) => {
    setExpandedScores(prev => ({
      ...prev,
      [scoreId]: !prev[scoreId]
    }));
  };

  const toggleResourceExpansion = (resourceId: string) => {
    setExpandedResources(prev => ({
      ...prev,
      [resourceId]: !prev[resourceId]
    }));
  };

  const renderSongView = () => {
    if (!selectedSong) return null;

    return (
      <View style={styles.songView}>
        <View style={styles.viewToggleContainer}>
          <TouchableOpacity 
            style={[
              styles.viewToggleButton,
              activeView === 'tracks' && styles.viewToggleButtonActive
            ]}
            onPress={() => setActiveView('tracks')}
          >
            <Ionicons 
              name="musical-notes" 
              size={20} 
              color={activeView === 'tracks' ? '#BB86FC' : '#BBBBBB'} 
            />
            <Text style={[
              styles.viewToggleText,
              activeView === 'tracks' && styles.viewToggleTextActive
            ]}>Tracks</Text>
          </TouchableOpacity>
          {selectedSong.lyrics && (
            <TouchableOpacity 
              style={[
                styles.viewToggleButton,
                activeView === 'lyrics' && styles.viewToggleButtonActive
              ]}
              onPress={() => setActiveView('lyrics')}
            >
              <Ionicons 
                name="document-text" 
                size={20} 
                color={activeView === 'lyrics' ? '#BB86FC' : '#BBBBBB'} 
              />
              <Text style={[
                styles.viewToggleText,
                activeView === 'lyrics' && styles.viewToggleTextActive
              ]}>Lyrics</Text>
            </TouchableOpacity>
          )}
          {selectedSong.scores && selectedSong.scores.length > 0 && (
            <TouchableOpacity 
              style={[
                styles.viewToggleButton,
                activeView === 'score' && styles.viewToggleButtonActive
              ]}
              onPress={() => setActiveView('score')}
            >
              <Ionicons 
                name="musical-note" 
                size={20} 
                color={activeView === 'score' ? '#BB86FC' : '#BBBBBB'} 
              />
              <Text style={[
                styles.viewToggleText,
                activeView === 'score' && styles.viewToggleTextActive
              ]}>Scores</Text>
            </TouchableOpacity>
          )}
          {selectedSong.resources && selectedSong.resources.length > 0 && (
            <TouchableOpacity 
              style={[
                styles.viewToggleButton,
                activeView === 'resources' && styles.viewToggleButtonActive
              ]}
              onPress={() => setActiveView('resources')}
            >
              <Ionicons 
                name="link" 
                size={20} 
                color={activeView === 'resources' ? '#BB86FC' : '#BBBBBB'} 
              />
              <Text style={[
                styles.viewToggleText,
                activeView === 'resources' && styles.viewToggleTextActive
              ]}>Links</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={styles.contentScrollView}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
          >
            {activeView === 'tracks' ? (
              // Tracks view content
              <View style={isLandscape ? styles.tracksLandscapeContainer : styles.tracksPortraitContainer}>
                {isLoadingTrackStates && (
                  <View style={styles.trackStateLoadingContainer}>
                    <ActivityIndicator size="small" color="#BB86FC" />
                    <Text style={styles.trackStateLoadingText}>Loading track states...</Text>
                  </View>
                )}
                {(selectedSong.tracks || []).map(track => (
                  <TouchableOpacity 
                    key={track.id} 
                    style={[
                      styles.trackContainer,
                      isLandscape && styles.trackContainerLandscape
                    ]}
                    onPress={() => handleTrackClick(track.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackName}>{track.name}</Text>
                      <View style={styles.trackControls}>
                        {loadingTracks[track.id] ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#BB86FC" />
                            <Text style={styles.loadingText}>Loading...</Text>
                          </View>
                        ) : (
                          <>
                            <TouchableOpacity 
                              style={[
                                styles.trackToggleButton,
                                soloedTrackIds.includes(track.id) && styles.soloActiveButton
                              ]} 
                              onPress={() => toggleSolo(track.id)}
                            >
                              <Text style={[
                                styles.trackButtonText,
                                soloedTrackIds.includes(track.id) && styles.soloActiveText
                              ]}>S</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[
                                styles.trackToggleButton,
                                !activeTrackIds.includes(track.id) && styles.muteActiveButton
                              ]} 
                              onPress={() => toggleTrack(track.id)}
                            >
                              <Text style={[
                                styles.trackButtonText,
                                !activeTrackIds.includes(track.id) && styles.muteActiveText
                              ]}>M</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.volumeContainer}>
                      <Ionicons 
                        name={
                          loadingTracks[track.id] ? 'hourglass-outline' :
                          trackVolumes[track.id] === 0 ? 'volume-mute' :
                          trackVolumes[track.id] < 0.3 ? 'volume-low' :
                          trackVolumes[track.id] < 0.7 ? 'volume-medium' :
                          'volume-high'
                        } 
                        size={20} 
                        color="#BBBBBB" 
                      />
                      <Slider
                        style={styles.volumeSlider}
                        minimumValue={0}
                        maximumValue={1}
                        value={trackVolumes[track.id] || 1}
                        onValueChange={(value) => handleVolumeChange(track.id, value)}
                        minimumTrackTintColor="#BB86FC"
                        maximumTrackTintColor="#2C2C2C"
                        disabled={loadingTracks[track.id]}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : activeView === 'lyrics' ? (
              // Lyrics view content
              <View style={styles.lyricsContainer}>
                <View style={styles.lyricsHeader}>
                  {isAdminMode && (
                    <View style={styles.lyricsEditButtons}>
                      {isLyricsEditing ? (
                        <>
                          <TouchableOpacity
                            style={[styles.lyricsEditButton, styles.cancelButton]}
                            onPress={() => {
                              setIsLyricsEditing(false);
                              setEditedLyrics(selectedSong?.lyrics || '');
                            }}
                          >
                            <Text style={styles.lyricsEditButtonText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.lyricsEditButton, styles.saveButton]}
                            onPress={handleLyricsSave}
                          >
                            <Text style={styles.lyricsEditButtonText}>Save</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={startLyricsEditing}
                        >
                          <Ionicons name="create-outline" size={24} color="#BB86FC" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                {isLyricsEditing && isAdminMode ? (
                  <TextInput
                    style={styles.lyricsEditInput}
                    value={editedLyrics}
                    onChangeText={setEditedLyrics}
                    multiline
                    placeholder="Enter lyrics..."
                    placeholderTextColor="#666666"
                    textAlignVertical="top"
                  />
                ) : (
                  <Text style={styles.lyricsText}>{selectedSong.lyrics}</Text>
                )}
              </View>
            ) : activeView === 'score' ? (
              // Scores view content
              <View style={styles.sheetMusicContainer}>
                {selectedSong.scores?.map((score, index) => (
                  <View key={score.id} style={styles.scoreView}>
                    <TouchableOpacity
                      style={styles.scoreHeader}
                      onPress={() => toggleScoreExpansion(score.id)}
                    >
                      <Text style={styles.scoreTitle}>{score.name}</Text>
                      <Ionicons
                        name={expandedScores[score.id] ? "chevron-up" : "chevron-down"}
                        size={24}
                        color="#BB86FC"
                      />
                    </TouchableOpacity>
                    {expandedScores[score.id] && (
                      score.url.endsWith('.pdf') ? (
                        <View style={styles.sheetMusicView}>
                          <WebView
                            source={{ 
                              uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(score.url)}`
                            }}
                            style={{
                              height: 400,
                              width: Dimensions.get('window').width - 48,
                              backgroundColor: '#FFFFFF',
                            }}
                            onError={(syntheticEvent) => {
                              const { nativeEvent } = syntheticEvent;
                              console.error('WebView error:', nativeEvent);
                              Alert.alert(
                                'PDF Viewing Error',
                                'Unable to load PDF. You can try opening it in your browser.',
                                [
                                  {
                                    text: 'Open in Browser',
                                    onPress: () => {
                                      Linking.openURL(score.url);
                                    }
                                  },
                                  {
                                    text: 'Cancel',
                                    style: 'cancel'
                                  }
                                ]
                              );
                            }}
                            renderLoading={() => (
                              <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#BB86FC" />
                                <Text style={styles.loadingText}>Loading PDF...</Text>
                              </View>
                            )}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setFullScreenImage({ url: score.url, name: score.name })}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: score.url }}
                            style={styles.sheetMusicImage}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                ))}
              </View>
            ) : (
              // Resources view content
              <View style={styles.sheetMusicContainer}>
                {selectedSong.resources?.map((resource, index) => (
                  <View key={resource.id} style={styles.scoreView}>
                    <TouchableOpacity
                      style={styles.scoreHeader}
                      onPress={() => toggleResourceExpansion(resource.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scoreTitle}>{resource.name}</Text>
                        {resource.description && (
                          <Text style={styles.resourceDescription}>{resource.description}</Text>
                        )}
                      </View>
                      <Ionicons
                        name={expandedResources[resource.id] ? "chevron-up" : "chevron-down"}
                        size={24}
                        color="#BB86FC"
                      />
                    </TouchableOpacity>
                    {expandedResources[resource.id] && (
                      <View style={styles.resourceContent}>
                        {resource.type === 'youtube' ? (
                          <View style={styles.sheetMusicView}>
                            <WebView
                              source={{ uri: resource.url }}
                              style={{
                                height: 450,
                                width: Dimensions.get('window').width - 48,
                                backgroundColor: '#000000',
                              }}
                              allowsFullscreenVideo={true}
                              javaScriptEnabled={true}
                              domStorageEnabled={true}
                            />
                          </View>
                        ) : resource.type === 'pdf' ? (
                          <View style={styles.sheetMusicView}>
                            <WebView
                              source={{ 
                                uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(resource.url)}`
                              }}
                              style={{
                                height: 400,
                                width: Dimensions.get('window').width - 48,
                                backgroundColor: '#FFFFFF',
                              }}
                              javaScriptEnabled={true}
                              domStorageEnabled={true}
                              startInLoadingState={true}
                              onError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.error('PDF WebView error:', nativeEvent);
                                console.log('PDF URL:', resource.url);
                                console.log('Full PDF.js URL:', `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(resource.url)}`);
                                Alert.alert(
                                  'PDF Viewing Error',
                                  `Unable to load PDF: ${resource.url}\n\nThis might be due to CORS restrictions. You can try opening it in your browser.`,
                                  [
                                    {
                                      text: 'Open in Browser',
                                      onPress: () => {
                                        Linking.openURL(resource.url);
                                      }
                                    },
                                    {
                                      text: 'Try Alternative',
                                      onPress: () => {
                                        // Try opening with Google Docs viewer as fallback
                                        const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(resource.url)}&embedded=true`;
                                        Linking.openURL(googleDocsUrl);
                                      }
                                    },
                                    {
                                      text: 'Cancel',
                                      style: 'cancel'
                                    }
                                  ]
                                );
                              }}
                              onLoadStart={() => {
                                console.log('PDF loading started for:', resource.url);
                              }}
                              onLoadEnd={() => {
                                console.log('PDF loading ended for:', resource.url);
                              }}
                              onMessage={(event) => {
                                console.log('PDF WebView message:', event.nativeEvent.data);
                              }}
                              renderLoading={() => (
                                <View style={styles.loadingContainer}>
                                  <ActivityIndicator size="large" color="#BB86FC" />
                                  <Text style={styles.loadingText}>Loading PDF...</Text>
                                </View>
                              )}
                            />
                          </View>
                        ) : resource.type === 'download' ? (
                          <View style={styles.resourceLinkContainer}>
                            <TouchableOpacity
                              style={styles.resourceDownloadButton}
                              onPress={() => Linking.openURL(resource.url)}
                            >
                              <Ionicons name="download-outline" size={24} color="#FFFFFF" />
                              <Text style={styles.resourceDownloadText}>
                                Download File
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.resourceLinkContainer}>
                            <TouchableOpacity
                              style={styles.resourceLinkButton}
                              onPress={() => Linking.openURL(resource.url)}
                            >
                              <Ionicons name="open-outline" size={24} color="#FFFFFF" />
                              <Text style={styles.resourceLinkText}>Open Link</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderFullScreenImage = () => {
    if (!fullScreenImage) return null;

    return (
      <Modal
        visible={!!fullScreenImage}
        transparent={false}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setFullScreenImage(null);
          setImageScale(1);
          setImageTranslateX(0);
          setImageTranslateY(0);
        }}
      >
        <View style={styles.fullScreenContainer}>
          <StatusBar hidden={true} />
          <TouchableOpacity
            style={styles.fullScreenCloseButton}
            onPress={() => {
              setFullScreenImage(null);
              setImageScale(1);
              setImageTranslateX(0);
              setImageTranslateY(0);
            }}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          
          <ScrollView
            contentContainerStyle={styles.fullScreenImageContainer}
            maximumZoomScale={5}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            bouncesZoom={false}
            centerContent={true}
          >
            <Image
              source={{ uri: fullScreenImage.url }}
              style={[
                styles.fullScreenImage,
                {
                  transform: [
                    { scale: imageScale },
                    { translateX: imageTranslateX },
                    { translateY: imageTranslateY }
                  ]
                }
              ]}
              resizeMode="contain"
            />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const uploadLyricsFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain'],
        copyToCacheDirectory: true
      });
      
      if (result.assets && result.assets[0]) {
        const file = result.assets[0];
        const response = await fetch(file.uri);
        const text = await response.text();
        
        if (editingSong) {
          setEditingSong(prev => prev ? { ...prev, lyrics: text } : null);
        } else {
          setNewSong(prev => ({ ...prev, lyrics: text }));
        }
      }
    } catch (error) {
      console.error('Error uploading lyrics file:', error);
      Alert.alert('Error', 'Failed to upload lyrics file');
    }
  };

  // Add fast forward function
  const handleFastForward = async () => {
    if (!isInitialized || !selectedSong || !selectedSong.tracks || selectedSong.tracks.length === 0) return;
    
    const newPosition = Math.min(
      (trackProgress[selectedSong.tracks[0]?.id] || 0) + 10,
      trackDurations[selectedSong.tracks[0]?.id] || 0
    );
    
    await handleSeek(selectedSong.tracks![0].id, newPosition);
    
    // Sync with remote clients if admin
    if (sessionId && isAdmin) {
      const sessionRef = ref(database, `sessions/${sessionId}/state`);
      await set(sessionRef, {
        ...syncState,
        seekPosition: newPosition
      });
    }
  };

  // Add rewind function
  const handleRewind = async () => {
    if (!isInitialized || !selectedSong || !selectedSong.tracks || selectedSong.tracks.length === 0) return;
    
    const newPosition = Math.max(
      (trackProgress[selectedSong.tracks[0]?.id] || 0) - 10,
      0
    );
    
    await handleSeek(selectedSong.tracks![0].id, newPosition);
    
    // Sync with remote clients if admin
    if (sessionId && isAdmin) {
      const sessionRef = ref(database, `sessions/${sessionId}/state`);
      await set(sessionRef, {
        ...syncState,
        seekPosition: newPosition
      });
    }
  };

  // Add handleRestart function before the return statement
  const handleRestart = async () => {
    if (!isInitialized || !selectedSong) return;
    
    try {
      // First stop all players
      await Promise.all(players.map(player => player.stopAsync()));
      
      // Reset states
      setIsFinished(false);
      setSeekPosition(0);
      setTrackProgress({});
      
      // Reset all tracks to beginning
      await Promise.all(players.map(player => player.setPositionAsync(0)));
      
      // Start playback
      const playPromises = players.map(async (player, index) => {
        if (selectedSong.tracks && selectedSong.tracks[index] && activeTrackIds.includes(selectedSong.tracks[index].id)) {
          await player.playAsync();
        }
      });
      await Promise.all(playPromises);
      setIsPlaying(true);

      // Sync with remote clients if admin
      if (sessionId && isAdmin) {
        const sessionRef = ref(database, `sessions/${sessionId}/state`);
        await set(sessionRef, {
          ...syncState,
          isPlaying: true,
          seekPosition: 0
        });
      }
    } catch (error) {
      console.error('Error restarting playback:', error);
    }
  };

  // Add handleStop function
  const handleStop = async () => {
    if (!isInitialized || !selectedSong) return;
    
    try {
      // Stop all players
      await Promise.all(players.map(player => player.stopAsync()));
      
      // Reset states
      setIsFinished(false);
      setIsPlaying(false);
      setSeekPosition(0);
      setTrackProgress({});
      
      // Reset all tracks to beginning
      await Promise.all(players.map(player => player.setPositionAsync(0)));

      // Sync with remote clients if admin
      if (sessionId && isAdmin) {
        const sessionRef = ref(database, `sessions/${sessionId}/state`);
        await set(sessionRef, {
          ...syncState,
          isPlaying: false,
          seekPosition: 0
        });
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  // Add recording functions
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            maxFileSize: 0, // No file size limit
          },
          ios: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
            outputFormat: Audio.RecordingOptionsPresets.HIGH_QUALITY.ios.outputFormat,
            audioQuality: Audio.RecordingOptionsPresets.HIGH_QUALITY.ios.audioQuality,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        },
        (status) => {
          console.log('Recording status update:', status);
        },
        1000 // Update interval in milliseconds
      );
      
      console.log('Recording created successfully');
      setRecording(recording);
      setIsRecording(true);

      // Start song playback if a song is selected and not already playing
      if (selectedSong && !isPlaying) {
        await startLocalPlayback();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('Stopping recording...');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording URI:', uri);
      
      // Get the recording status to verify duration
      const status = await recording.getStatusAsync();
      console.log('Recording status:', status);
      
      setRecordedUri(uri);
      setRecording(null);
      setIsRecording(false);

      // Stop song playback if it's playing
      if (isPlaying) {
        await stopLocalPlayback();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const saveRecording = async () => {
    if (!recordedUri || !selectedSong) return;

    try {
      console.log('Saving recording from URI:', recordedUri);
      
      // Get file info to verify size and duration
      const fileInfo = await FileSystem.getInfoAsync(recordedUri);
      console.log('Recording file info:', fileInfo);

      // Create a file object from the recorded URI
      const response = await fetch(recordedUri);
      const blob = await response.blob();
      console.log('Recording blob size:', blob.size);
      
      const file = new File([blob], 'recording.mp3', { type: 'audio/mpeg' });

      // Create a DocumentPickerAsset-like object
      const recordingAsset = {
        uri: recordedUri,
        name: 'recording.mp3',
        type: 'audio/mpeg',
        size: blob.size,
      };

      // Create folder name from title
      const folderName = selectedSong.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filePath = `audio/${folderName}/${selectedSong.title} - ${recordingName}.mp3`;

      console.log('Uploading recording to path:', filePath);
      // Upload the recording
      await AudioStorageService.getInstance().uploadAudioFile(recordingAsset, filePath);

      // Add the new track to the song
      const newTrack = {
        id: generateId(),
        name: recordingName,
        path: filePath
      };

      // Update the song in Firebase
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, {
        ...selectedSong,
        tracks: [...(selectedSong.tracks || []), newTrack]
      });

      // Reset recording state
      setRecordedUri(null);
      setShowRecordingControls(false);
      setRecordingName('Voice Recording');

      // Reload the song to include the new track
      const updatedSong = { ...selectedSong, tracks: [...(selectedSong.tracks || []), newTrack] };
      setSelectedSong(updatedSong);
      
      console.log('Recording saved successfully');
    } catch (error) {
      console.error('Failed to save recording:', error);
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const cancelRecording = () => {
    setRecordedUri(null);
    setShowRecordingControls(false);
    setRecordingName('Voice Recording');
  };

  // Add recording controls to the UI
  const renderRecordingControls = () => {
    if (!showRecordingControls) return null;

    return (
      <View style={styles.recordingControls}>
        {!isRecording && !recordedUri && (
          <TouchableOpacity
            style={[styles.controlButton, styles.recordButton]}
            onPress={startRecording}
          >
            <Ionicons name="mic" size={32} color="#FF5252" />
          </TouchableOpacity>
        )}
        {isRecording && (
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={stopRecording}
          >
            <Ionicons name="stop-circle" size={32} color="#FF5252" />
          </TouchableOpacity>
        )}
        {recordedUri && (
          <View style={styles.recordingActions}>
            <TextInput
              style={styles.recordingNameInput}
              placeholder="Enter recording name"
              placeholderTextColor="#666666"
              value={recordingName}
              onChangeText={setRecordingName}
            />
            <TouchableOpacity
              style={[styles.controlButton, styles.saveButton]}
              onPress={saveRecording}
            >
              <Ionicons name="save" size={32} color="#4CAF50" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.cancelButton]}
              onPress={cancelRecording}
            >
              <Ionicons name="close-circle" size={32} color="#FF5252" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Add playback controls to the UI
  const renderPlaybackControls = () => (
    <View style={styles.playbackControlsContainer}>
      <View style={styles.playbackControls}>
        <TouchableOpacity 
          style={[styles.controlButton, styles.smallButton]} 
          onPress={handleShowAddToPlaylist}
        >
          <Ionicons 
            name="add-circle" 
            size={20} 
            color="#BB86FC" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.smallButton]} 
          onPress={handleRestart}
        >
          <Ionicons 
            name="refresh-circle" 
            size={20} 
            color="#BB86FC" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.smallButton]} 
          onPress={handleRewind}
        >
          <Ionicons 
            name="play-back" 
            size={20} 
            color="#BB86FC" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.playButton]} 
          onPress={isFinished ? handleRestart : togglePlayback}
        >
          <Ionicons 
            name={isFinished ? 'refresh-circle' : (isPlaying ? 'pause-circle' : 'play-circle')} 
            size={48} 
            color="#BB86FC" 
          />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.smallButton]} 
          onPress={handleFastForward}
        >
          <Ionicons 
            name="play-forward" 
            size={20} 
            color="#BB86FC" 
          />
        </TouchableOpacity>

        {selectedSong && (
          <>
            <TouchableOpacity
              style={[styles.controlButton, styles.smallButton]}
              onPress={() => setShowRecordingControls(!showRecordingControls)}
            >
              <Ionicons
                name={showRecordingControls ? 'mic-off' : 'mic'}
                size={20}
                color={showRecordingControls ? '#FF5252' : '#BB86FC'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.smallButton]}
              onPress={() => setIsRepeat(!isRepeat)}
            >
              <Ionicons
                name={isRepeat ? 'repeat' : 'repeat-outline'} 
                size={20}
                color={isRepeat ? '#BB86FC' : '#BBBBBB'} 
              />
            </TouchableOpacity>
          </>
        )}

        {/* Playlist Controls */}
      </View>
      {renderRecordingControls()}
      
      {/* Add to Playlist Modal */}
      <Modal
        visible={showAddToPlaylistModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddToPlaylistModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Playlist</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowAddToPlaylistModal(false)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Add "{selectedSong?.title}" to a playlist
            </Text>
            
            <FlatList
              data={userPlaylists}
              keyExtractor={(item) => `playlist-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(item)}
                >
                  <View style={styles.playlistItemContent}>
                    <Ionicons name="musical-notes" size={20} color="#BB86FC" />
                    <View style={styles.playlistItemText}>
                      <Text style={styles.playlistItemName}>{item.name}</Text>
                      <Text style={styles.playlistItemInfo}>
                        {item.songs.length} song{item.songs.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyPlaylists}>
                  <Ionicons name="musical-notes" size={48} color="#BBBBBB" />
                  <Text style={styles.emptyPlaylistsText}>No playlists found</Text>
                  <Text style={styles.emptyPlaylistsSubtext}>
                    Create a playlist first to add songs
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );

  // Add playback speed control function
  const handlePlaybackSpeedChange = async (speed: number) => {
    if (!isInitialized || !selectedSong) return;
    
    try {
      setPlaybackSpeed(speed);
      await Promise.all(players.map(player => player.setRateAsync(speed, true)));
      
      // Sync with remote clients if admin
      if (sessionId && isAdmin) {
        const sessionRef = ref(database, `sessions/${sessionId}/state`);
        await set(sessionRef, {
          ...syncState,
          playbackSpeed: speed
        });
      }
    } catch (error) {
      console.error('Error changing playback speed:', error);
    }
  };

  // Add function to toggle lyrics expansion
  const toggleLyricsExpansion = (songId: string) => {
    setExpandedLyricsIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(songId)) {
        newSet.delete(songId);
      } else {
        newSet.add(songId);
      }
      return newSet;
    });
  };

  // Playlist control functions
  const handlePreviousSong = async () => {
    if (currentPlaylist && playlistSongs.length > 0) {
      try {
        const newIndex = currentPlaylistIndex > 0 ? currentPlaylistIndex - 1 : playlistSongs.length - 1;
        const previousSong = playlistSongs[newIndex];
        
        if (previousSong) {
          setCurrentPlaylistIndex(newIndex);
          setSelectedSong(previousSong);
          setIsFinished(false);
          // Stop current playback and progress tracking
          setIsPlaying(false);
          // Reset initialization state for new song
          setIsInitialized(false);
          setLastAutoStartedSong(null); // Reset auto-start tracking for new song
          // Small delay to ensure proper cleanup before loading new song
          setTimeout(() => {
            handleSongSelect(previousSong);
          }, 100);
        }
      } catch (error) {
        console.error('Error going to previous song:', error);
        Alert.alert('Error', 'Failed to go to previous song');
      }
    }
  };

  const handleNextSong = async () => {
    if (currentPlaylist && playlistSongs.length > 0) {
      try {
        const newIndex = currentPlaylistIndex < playlistSongs.length - 1 ? currentPlaylistIndex + 1 : 0;
        const nextSong = playlistSongs[newIndex];
        
        if (nextSong) {
          setCurrentPlaylistIndex(newIndex);
          setSelectedSong(nextSong);
          setIsFinished(false);
          // Stop current playback and progress tracking
          setIsPlaying(false);
          // Reset initialization state for new song
          setIsInitialized(false);
          setLastAutoStartedSong(null); // Reset auto-start tracking for new song
          // Small delay to ensure proper cleanup before loading new song
          setTimeout(() => {
            handleSongSelect(nextSong);
          }, 100);
        }
      } catch (error) {
        console.error('Error going to next song:', error);
        Alert.alert('Error', 'Failed to go to next song');
      }
    }
  };

  const handleTogglePlaylistRepeat = () => {
    setIsPlaylistRepeating(!isPlaylistRepeating);
  };

  const handleJumpToSong = async (songIndex: number) => {
    if (!currentPlaylist || !playlistSongs || songIndex < 0 || songIndex >= playlistSongs.length) {
      return;
    }

    try {
      const targetSong = playlistSongs[songIndex];
      console.log('Jumping to song:', targetSong.title, 'at index:', songIndex);
      
      // Stop current playback
      await stopLocalPlayback();
      
      // Update playlist state
      setCurrentPlaylistIndex(songIndex);
      setSelectedSong(targetSong);
      setIsFinished(false);
      setIsPlaying(false);
      setIsInitialized(false);
      setLastAutoStartedSong(null);
      
      // Close modal
      setShowPlaylistSongsModal(false);
      
      // Small delay to ensure proper cleanup before loading new song
      setTimeout(() => {
        handleSongSelect(targetSong);
      }, 100);
    } catch (error) {
      console.error('Error jumping to song:', error);
      Alert.alert('Error', 'Failed to jump to song');
    }
  };

  const handleRestartPlaylist = async () => {
    if (!currentPlaylist || playlistSongs.length === 0) {
      Alert.alert('Info', 'No playlist active to restart.');
      return;
    }

    console.log('Restarting playlist:', currentPlaylist.name);
    try {
      // Stop current playback first to ensure a clean restart
      console.log('Stopping current playback...');
      await stopLocalPlayback();

      // Reset to the first song in the playlist
      const firstSong = playlistSongs[0];
      console.log('Restarting with first song:', firstSong.title);
      setCurrentPlaylistIndex(0);
      setSelectedSong(firstSong);
      setIsFinished(false);
      setIsPlaying(false);
      setIsInitialized(false);
      setLastAutoStartedSong(null); // Reset auto-start tracking

      // Small delay to ensure proper cleanup before loading new song
      setTimeout(async () => {
        console.log('Loading first song...');
        handleSongSelect(firstSong);
        // Auto-start playback after a short delay to ensure players are loaded
        setTimeout(async () => {
          try {
            console.log('Auto-starting playback...');
            await startLocalPlayback();
            console.log('Playback started successfully');
          } catch (error) {
            console.error('Error auto-starting playlist restart playback:', error);
          }
        }, 500);
      }, 100);

      Alert.alert('Playlist Restarted', 'Playing from the beginning.');
    } catch (error) {
      console.error('Error restarting playlist:', error);
      Alert.alert('Error', 'Failed to restart playlist');
    }
  };

  const handleBackToPlaylists = () => {
    // Navigate directly to playlists view without stopping the playlist
    if (onNavigateToPlaylists) {
      onNavigateToPlaylists(songs);
    }
  };

  const handleStopPlaylist = async () => {
    try {
      // Stop current playback
      await stopLocalPlayback();
      
      // Reset playlist state
      setIsPlaylistMode(false);
      setCurrentPlaylist(null);
      setPlaylistSongs([]);
      setCurrentPlaylistIndex(0);
      setSelectedSong(null);
      setIsPlaying(false);
      setLastAutoStartedSong(null); // Reset auto-start tracking
      setIsPlaylistRepeating(false); // Reset repeat state
      
      // Navigate back to playlists view
      if (onNavigateToPlaylists) {
        onNavigateToPlaylists(songs);
      }
    } catch (error) {
      console.error('Error stopping playlist:', error);
      Alert.alert('Error', 'Failed to stop playlist');
    }
  };

  // Add to playlist functions
  const loadUserPlaylists = async () => {
    if (!user) return;
    
    try {
      const playlists = await playlistService.getUserPlaylists(user.id);
      setUserPlaylists(playlists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      Alert.alert('Error', 'Failed to load playlists');
    }
  };

  const handleAddToPlaylist = async (playlist: Playlist) => {
    if (!selectedSong || !user) return;

    try {
      await playlistService.addSongToPlaylist(playlist.id, {
        songId: selectedSong.id
      }, selectedSong as any);
      
      setShowAddToPlaylistModal(false);
      Alert.alert('Success', `Song added to "${playlist.name}"`);
    } catch (error) {
      console.error('Error adding song to playlist:', error);
      Alert.alert('Error', 'Failed to add song to playlist');
    }
  };

  const handleShowAddToPlaylist = () => {
    if (!selectedSong) return;
    loadUserPlaylists();
    setShowAddToPlaylistModal(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="light" />
      <SafeAreaView style={styles.content}>
        {!selectedSong ? (
          <View style={styles.mainContent}>
            {renderSongList()}
          </View>
        ) : (
          // Track Player View
          <>
            {/* Header for playlist mode */}
            {isPlaylistMode && currentPlaylist ? (
              <Header 
                title={currentPlaylist.name}
                onBack={handleBackToPlaylists}
              />
            ) : (
              <View style={[styles.header, isLandscape && styles.headerLandscape]}>
                <View style={[styles.headerTop, isLandscape && styles.headerTopLandscape]}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setSelectedSong(null)}
                  >
                    <Ionicons name="chevron-back" size={24} color="#BB86FC" />
                  </TouchableOpacity>
                  
                  <View style={styles.songHeaderText}>
                    <MarqueeText 
                      text={selectedSong.title} 
                      style={[styles.title, { textAlign: 'center' }]}
                    />
                    <Text style={[styles.artist, { textAlign: 'center' }]} numberOfLines={1}>
                      {selectedSong.artist}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* Playlist controls section */}
             {isPlaylistMode && currentPlaylist && (
               <View style={styles.playlistControlsSection}>
                 <View style={styles.playlistTrackInfo}>
                   <Text style={styles.playlistTrackCount}>
                     {currentPlaylistIndex + 1} of {playlistSongs.length}
                   </Text>
                   <MarqueeText 
                     text={selectedSong.title} 
                     style={styles.playlistSongTitle}
                   />
                   <Text style={styles.playlistSongArtist} numberOfLines={1}>
                     {selectedSong.artist}
                   </Text>
                 </View>
                
                <View style={styles.playlistControls}>
                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistListBtn]}
                    onPress={() => setShowPlaylistSongsModal(true)}
                  >
                    <Ionicons name="list" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistPrevBtn]}
                    onPress={handlePreviousSong}
                  >
                    <Ionicons name="play-skip-back" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistPauseBtn]}
                    onPress={async () => {
                      console.log('Playlist pause/resume pressed, isPlaying:', isPlaying);
                      if (isPlaying) {
                        console.log('Stopping playback...');
                        await stopLocalPlayback();
                      } else {
                        console.log('Starting playback...');
                        await startLocalPlayback();
                      }
                    }}
                  >
                    <Ionicons 
                      name={isPlaying ? 'pause' : 'play'} 
                      size={18} 
                      color="#FFFFFF" 
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistNextBtn]}
                    onPress={handleNextSong}
                  >
                    <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistRestartBtn, isPlaylistRepeating && styles.playlistRepeatActive]}
                    onPress={handleTogglePlaylistRepeat}
                  >
                    <Ionicons name="repeat" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Add spacing between header and playback controls */}
            <View style={styles.headerSpacing} />
            
            {selectedSong.tracks && selectedSong.tracks.length > 0 && (
              <View style={styles.playbackControlsContainer}>
                {renderPlaybackControls()}
              </View>
            )}
            
            {selectedSong.tracks && selectedSong.tracks.length > 0 && (
                <View style={styles.seekbarContainer}>
                  <Text style={styles.timeText}>
                    {formatTime(trackProgress[selectedSong.tracks[0]?.id] || 0)}
                  </Text>
                  <Slider
                    style={styles.seekbar}
                    minimumValue={0}
                    maximumValue={trackDurations[selectedSong.tracks[0]?.id] || 0}
                    value={isSeeking ? seekPosition : (trackProgress[selectedSong.tracks[0]?.id] || 0)}
                    onSlidingStart={() => setIsSeeking(true)}
                    onSlidingComplete={async (value) => {
                      setIsSeeking(false);
                      await handleSeek(selectedSong.tracks![0].id, value);
                      
                      // Sync with remote clients if admin
                      if (sessionId && isAdmin) {
                        const sessionRef = ref(database, `sessions/${sessionId}/state`);
                        await set(sessionRef, {
                          ...syncState,
                          seekPosition: value
                        });
                      }
                    }}
                    onValueChange={(value) => {
                      setSeekPosition(value);
                    }}
                    minimumTrackTintColor="#BB86FC"
                    maximumTrackTintColor="#2C2C2C"
                  />
                  <View style={styles.seekbarEndContainer}>
                    <Text style={styles.timeText}>
                      {formatTime(trackDurations[selectedSong.tracks[0]?.id] || 0)}
                    </Text>
                    {selectedSong && (
                      <TouchableOpacity
                        style={[styles.speedButton, playbackSpeed !== 1.0 && styles.speedButtonActive]}
                        onPress={() => {
                          const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                          const currentIndex = speeds.indexOf(playbackSpeed);
                          const nextIndex = (currentIndex + 1) % speeds.length;
                          handlePlaybackSpeedChange(speeds[nextIndex]);
                        }}
                      >
                        <Text style={[styles.speedText, { color: playbackSpeed !== 1.0 ? '#BB86FC' : '#BBBBBB' }]}>
                          {playbackSpeed}x
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            
            <View style={[styles.mainContent, { paddingBottom: insets.bottom }]}>
              {renderSongView()}
            </View>
          </>
        )}
        
        {/* Bottom Navigation - Only show on song list view */}
        {!selectedSong && (
          <View style={[styles.bottomNavigation, { paddingBottom: insets.bottom }]}>
            {onNavigateToPlaylists && (
              <TouchableOpacity
                style={styles.bottomNavButton}
                onPress={() => onNavigateToPlaylists(songs)}
              >
                <Ionicons 
                  name="musical-notes" 
                  size={24} 
                  color="#BB86FC" 
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.bottomNavButton, showFavoritesOnly && styles.activeFilterButton]}
              onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Ionicons 
                name="star" 
                size={24} 
                color={showFavoritesOnly ? "#BB86FC" : "#BB86FC"} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomNavButton}
              onPress={() => setIsSessionMenuExpanded(!isSessionMenuExpanded)}
            >
              <Ionicons 
                name="people" 
                size={24} 
                color="#BB86FC" 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomNavButton}
              onPress={onNavigateToProfile}
            >
              <Ionicons 
                name="person-circle" 
                size={24} 
                color="#BB86FC" 
              />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
      {showJoinDialog && renderJoinDialog()}
      {showSessionIdDialog && renderSessionIdDialog()}
      {showSessionsList && renderSessionsList()}
      {showAddSongDialog && renderAddSongDialog()}
      {showEditSongDialog && renderEditSongDialog()}
      {showDeleteConfirmDialog && renderDeleteConfirmDialog()}
      {showPasswordDialog && renderPasswordDialog()}
      {showSongPasswordDialog && renderSongPasswordDialog()}
      {renderFullScreenImage()}
      
      {/* Playlist Songs Modal */}
      <Modal
        visible={showPlaylistSongsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.playlistModalContainer}>
          <View style={styles.playlistModalHeader}>
            <TouchableOpacity onPress={() => setShowPlaylistSongsModal(false)}>
              <Text style={styles.playlistModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.playlistModalTitle}>Playlist Songs</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <View style={styles.playlistModalContent}>
            <FlatList
              data={playlistSongs}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.playlistSongItem,
                    index === currentPlaylistIndex && styles.playlistSongItemActive
                  ]}
                  onPress={() => handleJumpToSong(index)}
                >
                  <View style={styles.playlistSongInfo}>
                    <Text style={[
                      styles.playlistSongNumber,
                      index === currentPlaylistIndex && styles.playlistSongNumberActive
                    ]}>
                      {index + 1}
                    </Text>
                    <View style={styles.playlistSongDetails}>
                      <Text style={[
                        styles.playlistSongTitle,
                        index === currentPlaylistIndex && styles.playlistSongTitleActive
                      ]}>
                        {item.title}
                      </Text>
                      <Text style={styles.playlistSongArtist}>
                        {item.artist}
                      </Text>
                    </View>
                  </View>
                  {index === currentPlaylistIndex && (
                    <Ionicons name="play" size={20} color="#BB86FC" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => `playlist-song-${item.id}-${index}`}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default HomePage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  statusBarBackground: {
    height: 24,
    backgroundColor: '#121212'
  },
  content: {
    flex: 1
  },
  mainContent: {
    flex: 1,
    paddingBottom: 0, // No extra padding needed with flex layout
  },
  bottomNavigation: {
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  bottomNavButton: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
    backgroundColor: '#1E1E1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  headerLandscape: {
    padding: 8,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  headerTopLandscape: {
    marginBottom: 8,
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songHeaderText: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  artist: {
    fontSize: 16,
    color: '#BBBBBB',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 1,
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 8,
    maxWidth: '100%',
    flexWrap: 'wrap',
  },
  sessionIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  sessionIdButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  sessionIdButtonMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  sessionId: {
    fontSize: 13,
    color: '#FFFFFF',
    marginRight: 8,
    flexShrink: 1,
    fontWeight: '500',
  },
  leaveButton: {
    padding: 6,
    backgroundColor: '#3D0C11',
    borderRadius: 6,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  controlButton: {
    padding: 8,
    borderRadius: 25,
    backgroundColor: '#2C2C2C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButtons: {
    flexDirection: 'row',
    marginRight: 12,
  },
  syncButton: {
    padding: 8,
    borderRadius: 25,
    backgroundColor: '#2C2C2C',
  },
  seekbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  songListContainer: {
    flex: 1,
    padding: 16,
  },
  appTitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: '#121212',
    marginHorizontal: -16, // Offset the container padding
    marginTop: -16, // Offset the container padding
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#BB86FC',
    textAlign: 'center',
    fontWeight: '500',
  },
  songList: {
    flex: 1,
    marginTop: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
  },
  selectedSongItem: {
    backgroundColor: '#2C2C2C',
  },
  songInfo: {
    flex: 1,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#BBBBBB',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
    marginRight: 2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    backgroundColor: '#2C2C2C',
    borderRadius: 6,
  },
  loadingText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '500',
  },
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    flex: 1,
  },
  dialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogInput: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 16,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  dialogButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  dialogButtonCancel: {
    backgroundColor: '#3D0C11',
  },
  dialogButtonJoin: {
    backgroundColor: '#BB86FC',
  },
  dialogButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  songView: {
    flex: 1,
    backgroundColor: '#121212',
    height: '100%',
  },
  contentScrollView: {
    flex: 1,
    height: '100%',
  },
  trackContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  tracksPortraitContainer: {
    flex: 1,
  },
  tracksLandscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  trackContainerLandscape: {
    width: '48%',
    marginBottom: 8,
    minHeight: 120,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  trackName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  trackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackToggleButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#2C2C2C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 1,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#BB86FC',
  },
  soloActiveButton: {
    backgroundColor: '#4CAF50',
  },
  soloActiveText: {
    color: '#FFFFFF',
  },
  muteActiveButton: {
    backgroundColor: '#FF5252',
  },
  muteActiveText: {
    color: '#FFFFFF',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  volumeSlider: {
    flex: 1,
    height: 32,
    marginHorizontal: 6,
  },
  timeText: {
    fontSize: 11,
    color: '#BBBBBB',
    marginHorizontal: 6,
    fontVariant: ['tabular-nums'],
  },
  seekbar: {
    flex: 1,
    height: 32,
    marginHorizontal: 6,
  },
  noSessionsText: {
    color: '#BBBBBB',
    textAlign: 'center',
    marginVertical: 20,
  },
  sessionsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  sessionItem: {
    backgroundColor: '#2D2D2D',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sessionItemId: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionItemAdmin: {
    color: '#BBBBBB',
    fontSize: 14,
    marginBottom: 4,
  },
  sessionDate: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    marginHorizontal: 4,
  },
  joinButton: {
    backgroundColor: '#BB86FC',
  },
  deleteButton: {
    backgroundColor: '#3D0C11',
  },
  closeButton: {
    backgroundColor: '#3D0C11',
    marginTop: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sessionMenuContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  sessionMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  sessionMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sessionMenuContent: {
    backgroundColor: '#1F1F1F',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  activeSessionInfo: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionIdLabel: {
    color: '#BBBBBB',
    fontSize: 14,
    marginBottom: 8,
  },
  sessionIdText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sessionIdDialogContent: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sessionIdDisplay: {
    marginBottom: 12,
  },
  adminBadge: {
    fontSize: 10,
    color: '#4CAF50',
    backgroundColor: '#BB86FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionMenuButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sessionMenuButton: {
    flex: 1,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  sessionMenuButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  sessionMenuButtonSubtext: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  addSongButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  addSongButtonText: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  addSongForm: {
    maxHeight: 400,
  },
  tracksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tracksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTrackButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
  },
  trackUploadContainer: {
    marginBottom: 12,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackNameInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  fileNameContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  fileName: {
    color: '#BBBBBB',
    fontSize: 12,
  },
  uploadButton: {
    backgroundColor: '#2C2C2C',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    minWidth: 120,
  },
  uploadButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginTop: 8,
  },
  expandButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    marginRight: 4,
  },
  removeTrackButton: {
    padding: 4,
  },
  trackUploadLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  contentIndicators: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 1,
  },
  contentIndicator: {
    backgroundColor: 'rgba(42, 42, 42, 0.8)',
    borderRadius: 4,
    padding: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(187, 134, 252, 0.6)',
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  favoriteButton: {
    padding: 4,
  },
  dialogButtonDelete: {
    backgroundColor: '#3D0C11',
  },
  dialogText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
  },
  dialogButtonPrimary: {
    backgroundColor: '#BB86FC',
  },
  dialogButtonSecondary: {
    backgroundColor: '#2C2C2C',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  centeredTrashButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  activeFilterButton: {
    backgroundColor: '#2C2C2C',
    borderRadius: 4,
  },
  uploadPrompt: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  menuButtonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  menuButtonPrimary: {
    backgroundColor: '#BB86FC',
  },
  menuButtonSecondary: {
    backgroundColor: '#BB86FC',
  },
  menuButtonDelete: {
    backgroundColor: '#CF6679',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lyricsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  lyricsContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
  },
  lyricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lyricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  lyricsText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    gap: 8,
  },
  viewToggleButtonActive: {
    backgroundColor: '#2C2C2C',
  },
  viewToggleText: {
    color: '#BBBBBB',
    fontSize: 14,
    fontWeight: '500',
  },
  viewToggleTextActive: {
    color: '#BB86FC',
  },
  sheetMusicContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 8,
    flex: 1,
    minHeight: 300,
  },
  sheetMusicView: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 8,
  },
  sheetMusicImage: {
    width: '100%',
    height: 400,
  },
  lyricsInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  lyricsEditButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  lyricsEditButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: '#2C2C2C',
  },
  saveButton: {
    backgroundColor: '#BB86FC',
  },
  lyricsEditButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  lyricsEditInput: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 400,
    textAlignVertical: 'top',
  },
  scoreActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  deleteScoreButton: {
    padding: 4,
    backgroundColor: '#3D0C11',
    borderRadius: 4,
  },
  scoreList: {
    marginBottom: 12,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  scoreView: {
    marginBottom: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 4,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  resourceDescription: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 4,
  },
  resourceContent: {
    marginTop: 8,
  },
  resourceLinkContainer: {
    padding: 16,
    alignItems: 'center',
  },
  resourceDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BB86FC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  resourceDownloadText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resourceLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BB86FC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  resourceLinkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resourceItemContainer: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
  },
  resourceTypeContainer: {
    marginVertical: 8,
  },
  resourceTypeLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  resourceTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resourceTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#444444',
  },
  resourceTypeButtonActive: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  resourceTypeButtonText: {
    color: '#AAAAAA',
    fontSize: 12,
  },
  resourceTypeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dialogContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
  },
  dialogScrollView: {
    maxHeight: '100%',
  },
  pdfView: {
    flex: 1,
    width: Dimensions.get('window').width - 48, // Account for padding
    backgroundColor: '#FFFFFF',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    marginBottom: 8,
  },
  playbackControlsContainer: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  smallButton: {
    width: 36,
    height: 36,
  },
  playButton: {
    width: 64,
    height: 64,
  },
  recordingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#1F1F1F',
    borderRadius: 10,
  },
  recordingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  recordButton: {
    backgroundColor: '#1F1F1F',
  },
  stopButton: {
    backgroundColor: '#1F1F1F',
  },
  fullSessionId: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: '#2D2D2D',
    padding: 12,
    borderRadius: 6,
    textAlign: 'center',
    marginBottom: 16,
  },
  recordingNameInput: {
    backgroundColor: '#2C2C2C',
    color: '#FFFFFF',
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
    minWidth: 150,
  },
  speedText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  seekbarEndContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#2C2C2C',
  },
  speedButtonActive: {
    backgroundColor: '#1F1F1F',
  },
  matchIndicator: {
    flexDirection: 'column',
    marginTop: 4,
    gap: 4,
  },
  matchText: {
    fontSize: 12,
    color: '#BB86FC',
    fontStyle: 'italic',
  },
  lyricsSnippet: {
    fontSize: 12,
    color: '#BBBBBB',
    marginLeft: 18, // Align with the text after the icon
  },
  highlightedTerm: {
    color: '#BB86FC',
    fontWeight: 'bold',
  },
  artistContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchBadge: {
    backgroundColor: '#BB86FC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lyricsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snippetsContainer: {
    marginLeft: 18,
  },
  searchAndFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  integratedActionButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  integratedActiveButton: {
    backgroundColor: '#BB86FC',
  },
  artistFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  artistFilterOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  artistFilterOptionTextSelected: {
    color: '#BB86FC',
    fontWeight: '600',
  },
  filterIcon: {
    marginRight: 8,
  },
  artistFilterText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  sortButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#1F1F1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  artistFilterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  adminButton: {
    backgroundColor: '#BB86FC',
  },
  clientButton: {
    backgroundColor: '#BB86FC',
  },
  passwordDialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    maxHeight: '90%',
    justifyContent: 'center',
  },
  passwordDialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Song password dialog styles
  songPasswordModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
  },
  songPasswordModal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333333',
  },
  songPasswordHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  songPasswordTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  songPasswordSubtitle: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
  },
  songPasswordContent: {
    marginBottom: 8,
  },
  songPasswordInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  songPasswordError: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  songPasswordButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  songPasswordCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
  },
  songPasswordCancelText: {
    color: '#BBBBBB',
    fontSize: 16,
    fontWeight: '500',
  },
  songPasswordSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#BB86FC',
    alignItems: 'center',
  },
  songPasswordSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  playlistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderRadius: 12,
    alignSelf: 'center',
  },
  playlistName: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  playlistTrackInfo: {
    color: '#BBBBBB',
    fontSize: 12,
    marginLeft: 8,
  },
  playlistControlsContainer: {
    backgroundColor: '#1E1E1E',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  playlistControlsHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  playlistControlsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playlistControlsSubtitle: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  playlistControlsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  playlistControlButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  previousButton: {
    backgroundColor: '#BB86FC',
  },
  nextButton: {
    backgroundColor: '#BB86FC',
  },
  playlistStopButton: {
    backgroundColor: '#FF6B6B',
  },
  playlistControlButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Add to Playlist Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    color: '#BBBBBB',
    fontSize: 14,
    marginBottom: 20,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    marginBottom: 8,
  },
  playlistItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playlistItemText: {
    marginLeft: 12,
    flex: 1,
  },
  playlistItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  playlistItemInfo: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 2,
  },
  emptyPlaylists: {
    alignItems: 'center',
    padding: 40,
  },
  emptyPlaylistsText: {
    color: '#BBBBBB',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyPlaylistsSubtext: {
    color: '#888888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Dedicated Playlist Section Styles
  playlistSection: {
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.2)',
    alignSelf: 'center',
    width: '100%',
  },
  playlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playlistTrackCount: {
    color: '#BBBBBB',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  playlistSongTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  playlistSongArtist: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  playlistTitle: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  playlistControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },
  playlistControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  playlistListBtn: {
    backgroundColor: '#6B7280',
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  playlistPrevBtn: {
    backgroundColor: '#BB86FC',
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  playlistPauseBtn: {
    backgroundColor: '#BB86FC',
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  playlistNextBtn: {
    backgroundColor: '#BB86FC',
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  playlistRestartBtn: {
    backgroundColor: '#6B7280',
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  playlistStopBtn: {
    backgroundColor: '#BB86FC',
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  playlistRepeatActive: {
    backgroundColor: '#BB86FC',
    borderColor: 'rgba(187, 134, 252, 0.3)',
  },
  playlistTrackCountContainer: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistModalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  playlistModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  playlistModalCancelText: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: '500',
  },
  playlistModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playlistModalContent: {
    flex: 1,
    padding: 16,
  },
  playlistSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  playlistSongItemActive: {
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderColor: '#BB86FC',
  },
  playlistSongInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playlistSongNumber: {
    color: '#BBBBBB',
    fontSize: 16,
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  playlistSongNumberActive: {
    color: '#BB86FC',
  },
  playlistSongDetails: {
    flex: 1,
    marginLeft: 12,
  },
  playlistSongTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  playlistSongTitleActive: {
    color: '#BB86FC',
  },
  playlistSongArtist: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  trackStateLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    marginBottom: 12,
  },
  trackStateLoadingText: {
    color: '#BB86FC',
    fontSize: 14,
    marginLeft: 8,
  },
  // New styles for playlist header
  playlistControlsSection: {
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.2)',
  },
  playlistTrackInfo: {
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'column',
  },
  songInfoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerSpacing: {
    height: 40,
  },
});