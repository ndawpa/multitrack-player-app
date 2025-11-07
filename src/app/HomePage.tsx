import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, FlatList, TextInput, Animated, Easing, Alert, Clipboard, ActivityIndicator, Image, Linking, Dimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database } from '../config/firebase';
import AudioStorageService from '../services/audioStorage';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { User, FilterState } from '../types/user';
import AuthService from '../services/authService';
import FavoritesService from '../services/favoritesService';
import AIAssistantAccessService from '../services/aiAssistantAccessService';
import PlaylistPlayerService from '../services/playlistPlayerService';
import PlaylistService from '../services/playlistService';
import TrackStateService, { TrackState, SongTrackStates } from '../services/trackStateService';
import { Playlist, CreatePlaylistForm } from '../types/playlist';
import { Song, Track, Score, Resource } from '../types/song';
import Header from '../components/Header';
import GroupManagement from '../components/GroupManagement';
import SongAccessManagement from '../components/SongAccessManagement';
import GroupService from '../services/groupService';
import { normalizeSearchText, matchesSearch, findMatchesInText } from '../utils/textNormalization';
import { useI18n } from '../contexts/I18nContext';

// Custom ID generator
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
};


// Add new interface for song creation
interface NewSongForm {
  title: string;
  artist: string;
  album?: string;
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
  album?: string;
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

// Right-to-left marquee text component (text appears from right and scrolls left)
const RightToLeftMarqueeText = ({ text, style }: { text: string; style: any }) => {
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = React.useState(0);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      // Start from the right (positive value = text off-screen to the right)
      scrollX.setValue(containerWidth);
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(scrollX, {
            toValue: -(textWidth),
            duration: Math.max(3000, (textWidth + containerWidth) * 20), // Duration based on text length
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scrollX, {
            toValue: containerWidth,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset if text fits
      scrollX.setValue(0);
    }
  }, [textWidth, containerWidth]);

  return (
    <View 
      style={[{ overflow: 'hidden' }, style]} 
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
  onNavigateToAIAssistant?: () => void;
  user: User | null;
  playlistToPlay?: {playlist: Playlist, songs: Song[]} | null;
  onPlaylistPlayed?: () => void;
  isAdminMode?: boolean;
  onAdminModeChange?: (isAdmin: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigateToProfile, onNavigateToPlaylists, onNavigateToAIAssistant, user, playlistToPlay, onPlaylistPlayed, isAdminMode: propIsAdminMode, onAdminModeChange }) => {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
  const [lyricsZoomScale, setLyricsZoomScale] = useState(1.0);
  const lyricsZoomScaleRef = useRef(1.0);
  const lyricsLastScaleRef = useRef(1.0);
  const [lyricsTranslateX, setLyricsTranslateX] = useState(0);
  const [lyricsTranslateY, setLyricsTranslateY] = useState(0);
  const lyricsTranslateXRef = useRef(0);
  const lyricsTranslateYRef = useRef(0);
  const lyricsLastPanXRef = useRef(0);
  const lyricsLastPanYRef = useRef(0);
  const [isSessionMenuExpanded, setIsSessionMenuExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [expandedScores, setExpandedScores] = useState<{ [key: string]: boolean }>({});
  const [scorePageIndices, setScorePageIndices] = useState<{ [key: string]: number }>({});
  const scoreScrollRefs = useRef<{ [key: string]: ScrollView | null }>({});
  const [expandedResources, setExpandedResources] = useState<{ [key: string]: boolean }>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Add playback speed state
  
  // Playlist state
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [isPlaylistMode, setIsPlaylistMode] = useState(false);
  
  // Filtered songs navigation state
  const [currentFilteredIndex, setCurrentFilteredIndex] = useState(-1);
  const [showNavigationControls, setShowNavigationControls] = useState(true);
  const [showFilteredSongsModal, setShowFilteredSongsModal] = useState(false);
  const [isFilteredRepeating, setIsFilteredRepeating] = useState(false);
  const [shouldAutoStartFiltered, setShouldAutoStartFiltered] = useState(false);
  // Playlist controls toggle state
  const [showPlaylistControls, setShowPlaylistControls] = useState(true);
  // Playlist player removed - using main audio system
  
  // Add to playlist state
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [playlistService] = useState(() => PlaylistService.getInstance());
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState<CreatePlaylistForm>({
    name: '',
    description: '',
    isPublic: false
  });
  
  // Track state persistence
  const [trackStateService] = useState(() => TrackStateService.getInstance());
  const [persistedTrackStates, setPersistedTrackStates] = useState<SongTrackStates>({});
  const [isLoadingTrackStates, setIsLoadingTrackStates] = useState(false);
  
  // Track click detection state
  const [trackClickTimers, setTrackClickTimers] = useState<{ [key: string]: ReturnType<typeof setTimeout> | null }>({});
  
  // Full-screen image state
  const [fullScreenImage, setFullScreenImage] = useState<{ url: string; name: string; pages?: string[]; currentPageIndex?: number } | null>(null);
  const [fullScreenPageIndex, setFullScreenPageIndex] = useState(0);
  const fullScreenScrollRef = useRef<ScrollView | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageTranslateX, setImageTranslateX] = useState(0);
  const [imageTranslateY, setImageTranslateY] = useState(0);
  const imageScaleRef = useRef(1);
  const imageLastScaleRef = useRef(1);
  const imageTranslateXRef = useRef(0);
  const imageTranslateYRef = useRef(0);
  const imageLastPanXRef = useRef(0);
  const imageLastPanYRef = useRef(0);
  const imageScaleAnimated = useRef(new Animated.Value(1)).current;
  const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
  
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
    album: '',
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
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [showSongAccessManagement, setShowSongAccessManagement] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(propIsAdminMode || false);
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const ADMIN_PASSWORD = 'admin123'; // You should change this to a more secure password

  // Zoom constants for finer control
  const ZOOM_INCREMENT = 0.1; // Small increment for granular control
  const MAX_ZOOM = 12.0; // Maximum zoom level
  const MIN_ZOOM = 0.1; // Minimum zoom level

  // Sync fullscreen page index when fullScreenImage changes
  useEffect(() => {
    if (fullScreenImage?.currentPageIndex !== undefined) {
      setFullScreenPageIndex(fullScreenImage.currentPageIndex);
    } else if (fullScreenImage && !fullScreenImage.pages) {
      setFullScreenPageIndex(0);
    }
    // Reset zoom and pan when image changes
    if (fullScreenImage) {
      setImageScale(1);
      setImageTranslateX(0);
      setImageTranslateY(0);
      imageScaleRef.current = 1;
      imageTranslateXRef.current = 0;
      imageTranslateYRef.current = 0;
      // Sync animated value
      imageScaleAnimated.setValue(1);
    }
  }, [fullScreenImage]);

  // Sync local admin mode state with prop
  useEffect(() => {
    if (propIsAdminMode !== undefined) {
      setIsAdminMode(propIsAdminMode);
    }
  }, [propIsAdminMode]);

  // Load user groups when user changes
  useEffect(() => {
    const loadUserGroups = async () => {
      if (user?.id) {
        try {
          const groupService = GroupService.getInstance();
          const groups = await groupService.getUserGroups(user.id);
          setUserGroups(groups.map(group => group.id));
        } catch (error) {
          console.error('Error loading user groups:', error);
          setUserGroups([]);
        }
      } else {
        setUserGroups([]);
      }
    };

    loadUserGroups();
  }, [user?.id]);

  // Check admin access when user changes
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (user?.id) {
        try {
          const accessService = AIAssistantAccessService.getInstance();
          const isAdmin = await accessService.isAdmin();
          setHasAdminAccess(isAdmin);
          console.log('Admin access:', isAdmin);
        } catch (error) {
          console.error('Error checking admin access:', error);
          setHasAdminAccess(false);
        }
      } else {
        setHasAdminAccess(false);
      }
    };

    checkAdminAccess();
  }, [user?.id]);

  // Check AI Assistant access when user changes
  useEffect(() => {
    const checkAIAssistantAccess = async () => {
      if (user?.id) {
        try {
          const accessService = AIAssistantAccessService.getInstance();
          const hasAccess = await accessService.checkUserAccess(user.id);
          setHasAIAssistantAccess(hasAccess);
          console.log('AI Assistant access:', hasAccess);
        } catch (error) {
          console.error('Error checking AI Assistant access:', error);
          setHasAIAssistantAccess(false); // Default to no access on error for security
        }
      } else {
        setHasAIAssistantAccess(false);
      }
    };

    checkAIAssistantAccess();
  }, [user?.id]);
  
  // Song operation password protection states
  const [showSongPasswordDialog, setShowSongPasswordDialog] = useState(false);
  const [songPassword, setSongPassword] = useState('');
  const [songPasswordError, setSongPasswordError] = useState('');
  const [pendingSongOperation, setPendingSongOperation] = useState<'admin' | null>(null);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'tracks' | 'lyrics' | 'sheetMusic' | 'score' | 'resources'>('tracks');
  const [isLyricsEditing, setIsLyricsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState('');
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editingScoreName, setEditingScoreName] = useState('');
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingResourceName, setEditingResourceName] = useState('');
  const [editingResourceUrl, setEditingResourceUrl] = useState('');
  const [editingResourceDescription, setEditingResourceDescription] = useState('');
  const [editingResourceType, setEditingResourceType] = useState<'youtube' | 'audio' | 'download' | 'link' | 'pdf'>('link');
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = useState({
    artist: true,
    album: true,
    content: true
  });
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [selectedAlbums, setSelectedAlbums] = useState<Set<string>>(new Set());
  const [artistSearchQuery, setArtistSearchQuery] = useState('');
  const [albumSearchQuery, setAlbumSearchQuery] = useState('');
  
  // Screen orientation state
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const isLandscape = screenData.width > screenData.height;

  // Favorites state
  const [favoriteSongs, setFavoriteSongs] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesService] = useState(() => FavoritesService.getInstance());
  const [authService] = useState(() => AuthService.getInstance());
  
  // AI Assistant access state
  const [hasAIAssistantAccess, setHasAIAssistantAccess] = useState(true); // Default to true for backward compatibility

  // Load filter state from user preferences
  const loadFilterState = () => {
    if (user?.preferences?.filters) {
      const filters = user.preferences.filters;
      setSearchQuery(filters.searchQuery || '');
      setSelectedArtists(new Set(filters.selectedArtists || []));
      setSelectedAlbums(new Set(filters.selectedAlbums || []));
      setShowFavoritesOnly(filters.showFavoritesOnly || false);
      setHasTracks(filters.hasTracks || false);
      setHasLyrics(filters.hasLyrics || false);
      setHasScores(filters.hasScores || false);
      setHasLinks(filters.hasLinks || false);
      setSortOrder(filters.sortOrder || 'asc');
    }
  };

  // Save filter state to user preferences
  const saveFilterState = async (filterUpdates: Partial<FilterState>) => {
    try {
      await authService.updateFilterPreferences(filterUpdates);
    } catch (error) {
      console.error('Error saving filter preferences:', error);
    }
  };
  
  // Content filter states
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

  // Load filter state when user changes
  useEffect(() => {
    if (user && user.preferences) {
      loadFilterState();
    }
  }, [user]);

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
              setShowPlaylistControls(true);
              Alert.alert('Playlist Complete', 'All songs in the playlist have been played');
            }
          } else if (!isPlaylistMode && filteredSongs.length > 0 && currentFilteredIndex >= 0) {
            // Auto-advance to next song in filtered songs
            let nextIndex = currentFilteredIndex < filteredSongs.length - 1 ? currentFilteredIndex + 1 : 0;
            
            // If repeating is enabled and we're at the end, restart from beginning
            if (nextIndex === 0 && currentFilteredIndex === filteredSongs.length - 1 && !isFilteredRepeating) {
              // Don't loop if repeat is not enabled - song finished, stay on current song
              console.log('Filtered songs finished - no repeat enabled');
            } else {
              const nextSong = filteredSongs[nextIndex];
              if (nextSong) {
                setCurrentFilteredIndex(nextIndex);
                setSelectedSong(nextSong);
                setIsFinished(false);
                setIsPlaying(false);
                setIsInitialized(false);
                setShouldAutoStartFiltered(true); // Auto-start the next song
                
                // Small delay to ensure proper cleanup before loading new song
                setTimeout(() => {
                  handleSongSelect(nextSong);
                }, 100);
              }
            }
          }
        }
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized, selectedSong, isFinished, activeTrackIds, isRepeat, isPlaylistMode, currentPlaylist, playlistSongs, currentPlaylistIndex, currentFilteredIndex, isFilteredRepeating]);

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

  // Reset zoom and translation when song changes
  useEffect(() => {
    setLyricsZoomScale(1.0);
    lyricsZoomScaleRef.current = 1.0;
    lyricsLastScaleRef.current = 1.0;
    setLyricsTranslateX(0);
    setLyricsTranslateY(0);
    lyricsTranslateXRef.current = 0;
    lyricsTranslateYRef.current = 0;
    lyricsLastPanXRef.current = 0;
    lyricsLastPanYRef.current = 0;
  }, [selectedSong?.id]);

  const handleSongSelect = async (song: Song) => {
    setIsPlaying(false);
    setSelectedSong(song);
    
    // Update current filtered index if not in playlist mode
    if (!isPlaylistMode) {
      const index = filteredSongs.findIndex(s => s.id === song.id);
      setCurrentFilteredIndex(index >= 0 ? index : -1);
    }
    
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
    
    // Apply access control filtering (only if not in admin mode)
    if (!isAdminMode && user) {
      filtered = filtered.filter(song => {
        // If no access control, song is public
        if (!song.accessControl) {
          return true;
        }
        
        // Check if song is public
        if (song.accessControl.visibility === 'public') {
          return true;
        }
        
        // Check if user is the creator
        if (song.createdBy === user.id) {
          return true;
        }
        
        // Check if user is in allowed users list
        if (song.accessControl.allowedUsers?.includes(user.id)) {
          return true;
        }
        
        // For group-restricted songs, check if user is in any allowed groups
        if (song.accessControl.visibility === 'group_restricted' && song.accessControl.allowedGroups) {
          const hasGroupAccess = song.accessControl.allowedGroups.some(groupId => 
            userGroups.includes(groupId)
          );
          return hasGroupAccess;
        }
        
        // If song is private and user is not creator or in allowed users, hide it
        return false;
      });
    }
    
    // Apply artist filter if selected
    if (selectedArtists.size > 0) {
      filtered = filtered.filter(song => selectedArtists.has(song.artist));
    }
    
    // Apply album filter if selected
    if (selectedAlbums.size > 0) {
      filtered = filtered.filter(song => song.album && selectedAlbums.has(song.album));
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
    if (searchQuery && searchQuery.trim()) {
      filtered = filtered
        .map(song => {
          const titleMatch = matchesSearch(searchQuery, song.title);
          const artistMatch = matchesSearch(searchQuery, song.artist);
          const lyricsMatch = song.lyrics && matchesSearch(searchQuery, song.lyrics);
          
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
        .sort((a, b) => {
          // First sort by priority (higher priority first - title matches come first)
          const priorityDiff = b.matchInfo.priority - a.matchInfo.priority;
          if (priorityDiff !== 0) return priorityDiff;
          
          // If same priority, sort alphabetically by title
          const titleA = a.title.toLowerCase();
          const titleB = b.title.toLowerCase();
          return sortOrder === 'asc' 
            ? titleA.localeCompare(titleB)
            : titleB.localeCompare(titleA);
        });
    } else {
      // No search query - sort alphabetically by title
      filtered = [...filtered].sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        return sortOrder === 'asc' 
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      });
    }
    
    console.log('Filtered songs:', filtered);
    return filtered;
  }, [searchQuery, selectedArtists, selectedAlbums, songs, sortOrder, showFavoritesOnly, favoriteSongs, hasTracks, hasLyrics, hasScores, hasLinks, isAdminMode, user, userGroups]);

  // Update currentFilteredIndex when filters change or selected song is no longer in filtered list
  useEffect(() => {
    if (!isPlaylistMode && selectedSong && filteredSongs.length > 0) {
      const index = filteredSongs.findIndex(s => s.id === selectedSong.id);
      if (index >= 0) {
        setCurrentFilteredIndex(index);
      } else {
        // Current song is no longer in filtered list, reset index
        setCurrentFilteredIndex(-1);
        setShouldAutoStartFiltered(false); // Reset auto-start flag when song is no longer in filtered list
      }
    } else if (!selectedSong) {
      // No song selected, reset index
      setCurrentFilteredIndex(-1);
      setShouldAutoStartFiltered(false); // Reset auto-start flag when no song selected
    }
  }, [filteredSongs, selectedSong, isPlaylistMode]);

  // Get unique artists for the filter dropdown
  const uniqueArtists = useMemo(() => {
    const artists = new Set(songs.map(song => song.artist));
    return Array.from(artists).sort();
  }, [songs]);

  // Get unique albums for the filter dropdown
  // If artists are selected, only show albums from those artists
  // Otherwise, show all albums
  const uniqueAlbums = useMemo(() => {
    let filteredSongs = songs;
    
    // If artists are selected, filter songs by those artists
    if (selectedArtists.size > 0) {
      filteredSongs = songs.filter(song => selectedArtists.has(song.artist));
    }
    
    // Extract unique albums (only songs that have an album field)
    const albums = new Set(
      filteredSongs
        .filter(song => song.album && song.album.trim().length > 0)
        .map(song => song.album!)
    );
    return Array.from(albums).sort();
  }, [songs, selectedArtists]);

  // Filtered artists based on search query
  const filteredArtists = useMemo(() => {
    if (!artistSearchQuery.trim()) {
      return uniqueArtists;
    }
    const query = normalizeSearchText(artistSearchQuery);
    return uniqueArtists.filter(artist => 
      normalizeSearchText(artist).includes(query)
    );
  }, [uniqueArtists, artistSearchQuery]);

  // Filtered albums based on search query
  const filteredAlbums = useMemo(() => {
    if (!albumSearchQuery.trim()) {
      return uniqueAlbums;
    }
    const query = normalizeSearchText(albumSearchQuery);
    return uniqueAlbums.filter(album => 
      normalizeSearchText(album).includes(query)
    );
  }, [uniqueAlbums, albumSearchQuery]);

  const toggleArtistSelection = (artist: string) => {
    setSelectedArtists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(artist)) {
        newSet.delete(artist);
      } else {
        newSet.add(artist);
      }
      // Save to user preferences
      saveFilterState({ selectedArtists: Array.from(newSet) });
      // Clear album selection when artists change to avoid invalid selections
      setSelectedAlbums(new Set());
      saveFilterState({ selectedAlbums: [] });
      return newSet;
    });
  };

  const toggleAlbumSelection = (album: string) => {
    setSelectedAlbums(prev => {
      const newSet = new Set(prev);
      if (newSet.has(album)) {
        newSet.delete(album);
      } else {
        newSet.add(album);
      }
      // Save to user preferences
      saveFilterState({ selectedAlbums: Array.from(newSet) });
      return newSet;
    });
  };

  // Content filter helper functions
  const clearContentFilters = () => {
    setHasTracks(false);
    setHasLyrics(false);
    setHasScores(false);
    setHasLinks(false);
    // Save to user preferences
    saveFilterState({ hasTracks: false, hasLyrics: false, hasScores: false, hasLinks: false });
  };

  const hasActiveContentFilters = () => {
    return hasTracks || hasLyrics || hasScores || hasLinks;
  };

  // Artist filter helper functions
  const clearArtistFilters = () => {
    setSelectedArtists(new Set());
    // Save to user preferences
    saveFilterState({ selectedArtists: [] });
    // Clear albums when clearing artists
    setSelectedAlbums(new Set());
    saveFilterState({ selectedAlbums: [] });
  };

  // Album filter helper functions
  const clearAlbumFilters = () => {
    setSelectedAlbums(new Set());
    // Save to user preferences
    saveFilterState({ selectedAlbums: [] });
  };

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedArtists(new Set());
    setSelectedAlbums(new Set());
    setHasTracks(false);
    setHasLyrics(false);
    setHasScores(false);
    setHasLinks(false);
    // Save to user preferences
    saveFilterState({ 
      selectedArtists: [], 
      selectedAlbums: [],
      hasTracks: false, 
      hasLyrics: false, 
      hasScores: false, 
      hasLinks: false 
    });
  };

  // Content filter toggle functions
  const toggleHasTracks = () => {
    const newValue = !hasTracks;
    setHasTracks(newValue);
    saveFilterState({ hasTracks: newValue });
  };

  const toggleHasLyrics = () => {
    const newValue = !hasLyrics;
    setHasLyrics(newValue);
    saveFilterState({ hasLyrics: newValue });
  };

  const toggleHasScores = () => {
    const newValue = !hasScores;
    setHasScores(newValue);
    saveFilterState({ hasScores: newValue });
  };

  const toggleHasLinks = () => {
    const newValue = !hasLinks;
    setHasLinks(newValue);
    saveFilterState({ hasLinks: newValue });
  };

  // Search and sort functions
  const handleSearchQueryChange = (text: string) => {
    setSearchQuery(text);
    saveFilterState({ searchQuery: text });
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    saveFilterState({ sortOrder: newOrder });
  };

  const toggleFavoritesFilter = () => {
    const newValue = !showFavoritesOnly;
    setShowFavoritesOnly(newValue);
    saveFilterState({ showFavoritesOnly: newValue });
  };

  const clearSearch = () => {
    setSearchQuery('');
    saveFilterState({ searchQuery: '' });
  };

  const renderSongItem = ({ item }: { item: Song & { matchInfo?: { titleMatch: boolean; artistMatch: boolean; lyricsMatch: boolean } } }) => {
    const hasLyricsMatch = item.lyrics && searchQuery && matchesSearch(searchQuery, item.lyrics);
    const isExpanded = expandedLyricsIds.has(item.id);
    
    // Function to render title with highlighted matches
    const renderTitleWithHighlight = () => {
      if (!searchQuery || !item.matchInfo?.titleMatch) {
        return <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>;
      }
      
      const matches = findMatchesInText(searchQuery, item.title);
      if (matches.length === 0) {
        return <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>;
      }
      
      // Sort matches by start position
      matches.sort((a, b) => a.start - b.start);
      
      // Build the highlighted text
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      
      for (const match of matches) {
        // Add text before the match
        if (match.start > lastIndex) {
          parts.push(item.title.slice(lastIndex, match.start));
        }
        
        // Add the highlighted match
        parts.push(
          <Text key={match.start} style={[styles.songTitle, styles.highlightedTerm]}>
            {item.title.slice(match.start, match.end)}
          </Text>
        );
        
        lastIndex = match.end;
      }
      
      // Add remaining text after the last match
      if (lastIndex < item.title.length) {
        parts.push(item.title.slice(lastIndex));
      }
      
      return (
        <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">
          {parts}
        </Text>
      );
    };
    
    // Function to get all lyrics snippets with context
    const getAllLyricsSnippets = () => {
      if (!item.lyrics || !searchQuery) return [];
      
      // Find all matches with their original text positions
      const matches = findMatchesInText(searchQuery, item.lyrics);
      const snippets = [];
      
      for (const match of matches) {
        // Get 30 characters before and after the match
        const start = Math.max(0, match.start - 30);
        const end = Math.min(item.lyrics.length, match.end + 30);
        
        const originalSnippet = item.lyrics.slice(start, end);
        const hasLeadingEllipsis = start > 0;
        const hasTrailingEllipsis = end < item.lyrics.length;
        
        // Calculate the highlight positions within the snippet (before adding ellipsis)
        const highlightStart = match.start - start;
        const highlightEnd = match.end - start;
        
        // Extract parts from original snippet
        const beforeTerm = originalSnippet.slice(0, highlightStart);
        const term = originalSnippet.slice(highlightStart, highlightEnd);
        const afterTerm = originalSnippet.slice(highlightEnd);
        
        snippets.push(
          <Text key={match.start} style={styles.lyricsSnippet}>
            {hasLeadingEllipsis && '...'}
            {beforeTerm}
            <Text style={styles.highlightedTerm}>{term}</Text>
            {afterTerm}
            {hasTrailingEllipsis && '...'}
          </Text>
        );
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
            {renderTitleWithHighlight()}
          </View>
          <View style={styles.artistContainer}>
            <Text style={styles.songArtist} numberOfLines={1} ellipsizeMode="tail">
              {item.album ? `${item.artist} - ${item.album}` : item.artist}
            </Text>
            {item.matchInfo?.artistMatch && (
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>Artist</Text>
              </View>
            )}
          </View>
          {searchQuery && hasLyricsMatch && (
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
              name={favoriteSongs.has(item.id) ? "heart" : "heart-outline"} 
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

  // Auto-start playback when returning from back button in filtered songs mode
  useEffect(() => {
    if (isInitialized && !isPlaylistMode && selectedSong && !isPlaying && shouldAutoStartFiltered && filteredSongs.length > 0 && currentFilteredIndex >= 0) {
      console.log('Auto-starting filtered song playback after back button:', { isInitialized, selectedSong: selectedSong.title, isPlaying });
      setShouldAutoStartFiltered(false);
      
      const startPlayback = async () => {
        try {
          console.log('Calling startLocalPlayback for filtered song...');
          await startLocalPlayback();
          console.log('startLocalPlayback completed successfully');
        } catch (error) {
          console.error('Error auto-starting filtered song playback:', error);
        }
      };
      
      // Small delay to ensure everything is ready
      setTimeout(startPlayback, 200);
    }
  }, [isInitialized, selectedSong, isPlaying, shouldAutoStartFiltered, filteredSongs.length, currentFilteredIndex, isPlaylistMode]);

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
            placeholder={t('home.search')}
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={handleSearchQueryChange}
          />
          <View style={styles.searchRightActions}>
            {searchQuery ? (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={clearSearch}
              >
                <Ionicons name="close-circle" size={20} color="#BBBBBB" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.integratedActionButton, (selectedArtists.size > 0 || selectedAlbums.size > 0 || hasActiveContentFilters()) && styles.integratedActiveButton]}
              onPress={() => {
                setShowFilterDialog(true);
              }}
            >
              <Ionicons 
                name="filter" 
                size={16} 
                color={(selectedArtists.size > 0 || selectedAlbums.size > 0 || hasActiveContentFilters()) ? "#FFFFFF" : "#BBBBBB"} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.integratedActionButton, sortOrder === 'desc' && styles.integratedActiveButton]}
              onPress={toggleSortOrder}
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
        <View style={styles.adminButtonsContainer}>
          <TouchableOpacity 
            style={styles.addSongButton}
            onPress={() => setShowAddSongDialog(true)}
          >
            <Ionicons name="add-circle" size={28} color="#BB86FC" />
            <Text style={styles.addSongButtonText}>Add New Song</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.groupManagementButton}
            onPress={() => setShowGroupManagement(true)}
          >
            <Ionicons name="people" size={28} color="#BB86FC" />
            <Text style={styles.groupManagementButtonText}>Manage Groups</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.songAccessButton}
            onPress={() => setShowSongAccessManagement(true)}
          >
            <Ionicons name="shield-checkmark" size={28} color="#BB86FC" />
            <Text style={styles.songAccessButtonText}>Song Access</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={filteredSongs}
        renderItem={renderSongItem}
        keyExtractor={item => item.id}
        style={styles.songList}
        showsVerticalScrollIndicator={false}
      />
      {showFilterDialog && (
        <KeyboardAvoidingView 
          style={styles.dialogOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.dialogContainer}>
            <Text style={styles.dialogTitle}>{t('home.filters')}</Text>
            <ScrollView style={styles.dialogScrollView}>
              {/* Artist Filter Section */}
              <View style={styles.filterSectionBox}>
                <TouchableOpacity 
                  style={styles.filterSectionHeader}
                  onPress={() => setExpandedFilterSections(prev => ({ ...prev, artist: !prev.artist }))}
                >
                  <Text style={styles.filterSectionTitle}>{t('home.artists')}</Text>
                  <Ionicons 
                    name={expandedFilterSections.artist ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#BB86FC" 
                  />
                </TouchableOpacity>
                {expandedFilterSections.artist && (
                  <View style={styles.filterSectionContent}>
                    <View style={styles.filterSearchContainer}>
                      <Ionicons name="search" size={16} color="#BBBBBB" style={styles.filterSearchIcon} />
                      <TextInput
                        style={styles.filterSearchInput}
                        placeholder={t('home.search')}
                        placeholderTextColor="#666666"
                        value={artistSearchQuery}
                        onChangeText={setArtistSearchQuery}
                      />
                      {artistSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setArtistSearchQuery('')}
                          style={styles.filterSearchClearButton}
                        >
                          <Ionicons name="close-circle" size={18} color="#BBBBBB" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {filteredArtists.map(artist => (
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
                    {filteredArtists.length === 0 && artistSearchQuery.trim() && (
                      <Text style={styles.emptyFilterText}>No artists found</Text>
                    )}
                    {uniqueArtists.length > 0 && (
                      <TouchableOpacity 
                        style={styles.clearSectionButton}
                        onPress={clearArtistFilters}
                      >
                        <Text style={styles.clearSectionButtonText}>Clear Artists</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Album Filter Section */}
              <View style={styles.filterSectionBox}>
                <TouchableOpacity 
                  style={styles.filterSectionHeader}
                  onPress={() => setExpandedFilterSections(prev => ({ ...prev, album: !prev.album }))}
                >
                  <Text style={styles.filterSectionTitle}>{t('home.albums')}</Text>
                  <Ionicons 
                    name={expandedFilterSections.album ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#BB86FC" 
                  />
                </TouchableOpacity>
                {expandedFilterSections.album && (
                  <View style={styles.filterSectionContent}>
                    <View style={styles.filterSearchContainer}>
                      <Ionicons name="search" size={16} color="#BBBBBB" style={styles.filterSearchIcon} />
                      <TextInput
                        style={styles.filterSearchInput}
                        placeholder={t('home.search')}
                        placeholderTextColor="#666666"
                        value={albumSearchQuery}
                        onChangeText={setAlbumSearchQuery}
                      />
                      {albumSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setAlbumSearchQuery('')}
                          style={styles.filterSearchClearButton}
                        >
                          <Ionicons name="close-circle" size={18} color="#BBBBBB" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {uniqueAlbums.length > 0 ? (
                      <>
                        {filteredAlbums.map(album => (
                          <TouchableOpacity
                            key={album}
                            style={styles.artistFilterOption}
                            onPress={() => toggleAlbumSelection(album)}
                          >
                            <View style={styles.artistFilterOptionContent}>
                              <Ionicons 
                                name={selectedAlbums.has(album) ? "checkbox" : "square-outline"} 
                                size={24} 
                                color={selectedAlbums.has(album) ? "#BB86FC" : "#BBBBBB"} 
                              />
                              <Text style={[
                                styles.artistFilterOptionText,
                                selectedAlbums.has(album) && styles.artistFilterOptionTextSelected
                              ]}>{album}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                    {filteredAlbums.length === 0 && albumSearchQuery.trim() && (
                      <Text style={styles.emptyFilterText}>No albums found</Text>
                    )}
                    {selectedAlbums.size > 0 && (
                      <TouchableOpacity 
                        style={styles.clearSectionButton}
                        onPress={clearAlbumFilters}
                      >
                        <Text style={styles.clearSectionButtonText}>Clear Albums</Text>
                      </TouchableOpacity>
                    )}
                    </>
                  ) : (
                    <Text style={styles.emptyFilterText}>
                      {selectedArtists.size > 0 
                        ? "No albums found for selected artists" 
                        : "No albums available"}
                    </Text>
                  )}
                  </View>
                )}
              </View>

              {/* Content Filter Section */}
              <View style={styles.filterSectionBox}>
                <TouchableOpacity 
                  style={styles.filterSectionHeader}
                  onPress={() => setExpandedFilterSections(prev => ({ ...prev, content: !prev.content }))}
                >
                  <Text style={styles.filterSectionTitle}>Filter by Content</Text>
                  <Ionicons 
                    name={expandedFilterSections.content ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#BB86FC" 
                  />
                </TouchableOpacity>
                {expandedFilterSections.content && (
                  <View style={styles.filterSectionContent}>
                    <TouchableOpacity
                  style={styles.artistFilterOption}
                  onPress={toggleHasTracks}
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
                  onPress={toggleHasLyrics}
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
                  onPress={toggleHasScores}
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
                  onPress={toggleHasLinks}
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
                    {hasActiveContentFilters() && (
                      <TouchableOpacity 
                        style={styles.clearSectionButton}
                        onPress={clearContentFilters}
                      >
                        <Text style={styles.clearSectionButtonText}>Clear Content</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={[styles.dialogButtonContainer, { justifyContent: 'space-between' }]}>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={clearAllFilters}
              >
                <Text style={styles.dialogButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.dialogButton, styles.dialogButtonSecondary]}
                onPress={() => setShowFilterDialog(false)}
              >
                <Text style={styles.dialogButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );

  // Add function to start editing a song
  const startEditingSong = (song: Song) => {
    setEditingSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
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

  // Add function to reorder tracks
  const reorderTracks = (data: EditSongForm['tracks']) => {
    if (!editingSong) return;
    setEditingSong(prev => ({
      ...prev!,
      tracks: data
    }));
  };

  // Add function to reorder scores
  const reorderScores = (data: Score[]) => {
    if (!editingSong) return;
    setEditingSong(prev => ({
      ...prev!,
      scores: data
    }));
  };

  // Add function to reorder resources
  const reorderResources = (data: Resource[]) => {
    if (!editingSong) return;
    setEditingSong(prev => ({
      ...prev!,
      resources: data
    }));
  };

  // Add function to reorder tracks in song view (admin only)
  const reorderSongTracks = async (data: Track[]) => {
    if (!selectedSong || !isAdminMode) return;
    try {
      const updatedSong = {
        ...selectedSong,
        tracks: data
      };
      setSelectedSong(updatedSong);
      
      // Save to Firebase
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, {
        ...selectedSong,
        tracks: data
      });
    } catch (error) {
      console.error('Error reordering tracks:', error);
      Alert.alert('Error', 'Failed to reorder tracks');
      // Revert on error
      setSelectedSong(selectedSong);
    }
  };

  // Add function to reorder scores in song view (admin only)
  const reorderSongScores = async (data: Score[]) => {
    if (!selectedSong || !isAdminMode) return;
    try {
      const updatedSong = {
        ...selectedSong,
        scores: data
      };
      setSelectedSong(updatedSong);
      
      // Save to Firebase
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, {
        ...selectedSong,
        scores: data
      });
    } catch (error) {
      console.error('Error reordering scores:', error);
      Alert.alert('Error', 'Failed to reorder scores');
      // Revert on error
      setSelectedSong(selectedSong);
    }
  };

  // Add function to reorder resources in song view (admin only)
  const reorderSongResources = async (data: Resource[]) => {
    if (!selectedSong || !isAdminMode) return;
    try {
      const updatedSong = {
        ...selectedSong,
        resources: data
      };
      setSelectedSong(updatedSong);
      
      // Save to Firebase
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, {
        ...selectedSong,
        resources: data
      });
    } catch (error) {
      console.error('Error reordering resources:', error);
      Alert.alert('Error', 'Failed to reorder resources');
      // Revert on error
      setSelectedSong(selectedSong);
    }
  };

  // Helper function to remove undefined values from an object (Firebase doesn't accept undefined)
  const removeUndefinedValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefinedValues(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = removeUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  };

  // Function to update song in Firebase
  const updateSongInFirebase = async (updates: Partial<Song>) => {
    if (!selectedSong) return;
    try {
      const updatedSong = { ...selectedSong, ...updates };
      // Remove undefined values before saving to Firebase
      const cleanedSong = removeUndefinedValues(updatedSong);
      setSelectedSong(updatedSong);
      const songRef = ref(database, `songs/${selectedSong.id}`);
      await set(songRef, cleanedSong);
    } catch (error) {
      console.error('Error updating song:', error);
      Alert.alert('Error', 'Failed to save changes');
      throw error;
    }
  };

  // Function to update track name
  const handleUpdateTrackName = async (trackId: string, newName: string) => {
    if (!selectedSong || !newName.trim() || !selectedSong.tracks) return;
    try {
      const updatedTracks = selectedSong.tracks.map(track =>
        track.id === trackId ? { ...track, name: newName } : track
      );
      await updateSongInFirebase({ tracks: updatedTracks });
      setEditingTrackId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update track name');
    }
  };

  // Function to delete track
  const handleDeleteTrack = async (trackId: string) => {
    if (!selectedSong || !selectedSong.tracks) return;
    Alert.alert(
      'Delete Track',
      'Are you sure you want to delete this track?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const track = selectedSong.tracks!.find(t => t.id === trackId);
              if (track?.path) {
                try {
                  await AudioStorageService.getInstance().deleteAudioFile(track.path);
                } catch (error) {
                  console.warn('Failed to delete file from storage:', error);
                }
              }
              const updatedTracks = selectedSong.tracks!.filter(t => t.id !== trackId);
              await updateSongInFirebase({ tracks: updatedTracks });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete track');
            }
          }
        }
      ]
    );
  };

  // Function to add track
  const handleAddTrack = async () => {
    if (!selectedSong) return;
    try {
      const result = await AudioStorageService.getInstance().pickAudioFile();
      if (result) {
        const folderName = selectedSong.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const trackName = result.name.replace(/\.[^/.]+$/, '');
        const path = `audio/${folderName}/${selectedSong.title} - ${trackName}.mp3`;
        
        await AudioStorageService.getInstance().uploadAudioFile(result, path);
        
        const newTrack: Track = {
          id: generateId(),
          name: trackName,
          path
        };
        const updatedTracks = [...(selectedSong.tracks || []), newTrack];
        await updateSongInFirebase({ tracks: updatedTracks });
      }
    } catch (error: any) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('Error adding track:', error);
        Alert.alert('Error', 'Failed to add track');
      }
    }
  };

  // Function to update score name
  const handleUpdateScoreName = async (scoreId: string, newName: string) => {
    if (!selectedSong || !newName.trim() || !selectedSong.scores) return;
    try {
      const updatedScores = selectedSong.scores.map(score =>
        score.id === scoreId ? { ...score, name: newName } : score
      );
      await updateSongInFirebase({ scores: updatedScores });
      setEditingScoreId(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update score name');
    }
  };

  // Function to delete score
  const handleDeleteScore = async (scoreId: string) => {
    if (!selectedSong || !selectedSong.scores) return;
    Alert.alert(
      'Delete Score',
      'Are you sure you want to delete this score?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedScores = selectedSong.scores!.filter(s => s.id !== scoreId);
              await updateSongInFirebase({ scores: updatedScores });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete score');
            }
          }
        }
      ]
    );
  };

  // Function to add score
  const handleAddScore = async () => {
    if (!selectedSong) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true
      });
      
      if (result.assets && result.assets[0]) {
        const file = result.assets[0];
        const scoreName = file.name.split('.')[0];
        
        const scoreId = generateId();
        const newScore: Score = {
          id: scoreId,
          name: scoreName,
          url: 'uploading'
        };
        const updatedScores = [...(selectedSong.scores || []), newScore];
        setSelectedSong({ ...selectedSong, scores: updatedScores });
        
        try {
          const downloadURL = await uploadSheetMusic(file, scoreName, selectedSong.title);
          const finalScores = updatedScores.map(score =>
            score.id === scoreId ? { ...score, url: downloadURL } : score
          );
          await updateSongInFirebase({ scores: finalScores });
        } catch (uploadError) {
          console.error('Error uploading score:', uploadError);
          Alert.alert('Error', 'Failed to upload score');
          const revertedScores = updatedScores.filter(s => s.id !== scoreId);
          await updateSongInFirebase({ scores: revertedScores });
        }
      }
    } catch (error: any) {
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('Error adding score:', error);
        Alert.alert('Error', 'Failed to add score');
      }
    }
  };

  // Function to update resource
  const handleUpdateResource = async () => {
    if (!selectedSong || !editingResourceId || !editingResourceName.trim() || !editingResourceUrl.trim() || !selectedSong.resources) return;
    try {
      const updatedResources = selectedSong.resources.map(resource =>
        resource.id === editingResourceId
          ? {
              ...resource,
              name: editingResourceName,
              url: editingResourceUrl,
              description: editingResourceDescription,
              type: editingResourceType
            }
          : resource
      );
      await updateSongInFirebase({ resources: updatedResources });
      setEditingResourceId(null);
      setEditingResourceName('');
      setEditingResourceUrl('');
      setEditingResourceDescription('');
      setEditingResourceType('link');
    } catch (error) {
      Alert.alert('Error', 'Failed to update resource');
    }
  };

  // Function to delete resource
  const handleDeleteResource = async (resourceId: string) => {
    if (!selectedSong || !selectedSong.resources) return;
    Alert.alert(
      'Delete Resource',
      'Are you sure you want to delete this resource?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedResources = selectedSong.resources!.filter(r => r.id !== resourceId);
              await updateSongInFirebase({ resources: updatedResources });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete resource');
            }
          }
        }
      ]
    );
  };

  // Function to add resource
  const handleAddResource = () => {
    if (!selectedSong) return;
    const newResource: Resource = {
      id: generateId(),
      name: '',
      type: 'link',
      url: '',
      description: ''
    };
    setEditingResourceId(newResource.id);
    setEditingResourceName('');
    setEditingResourceUrl('');
    setEditingResourceDescription('');
    setEditingResourceType('link');
    const updatedResources = [...(selectedSong.resources || []), newResource];
    setSelectedSong({ ...selectedSong, resources: updatedResources });
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

      // Clean scores to remove undefined values (Firebase doesn't accept undefined)
      const cleanedScores = (editingSong.scores || []).map(score => {
        const cleaned: any = { id: score.id, name: score.name };
        if (score.url !== undefined) cleaned.url = score.url;
        if (score.pages !== undefined && score.pages !== null) cleaned.pages = score.pages;
        return cleaned;
      });

      // Create song data object with explicit values
      const songData = {
        title: editingSong.title,
        artist: editingSong.artist,
        album: editingSong.album || undefined,
        tracks: updatedTracks,
        lyrics: editingSong.lyrics || '',
        scores: cleanedScores,
        resources: editingSong.resources || []
      };

      // Remove undefined values before saving to Firebase
      const cleanedSongData = removeUndefinedValues(songData);

      // Update song in Firebase
      const songRef = ref(database, `songs/${editingSong.id}`);
      await set(songRef, cleanedSongData);

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
          <ScrollView 
            style={styles.dialogScrollView}
            nestedScrollEnabled={true}
            scrollEventThrottle={16}
          >
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
            <TextInput
              style={styles.dialogInput}
              placeholder="Album (optional)"
              placeholderTextColor="#666666"
              value={editingSong.album || ''}
              onChangeText={(text) => setEditingSong(prev => prev ? { ...prev, album: text } : null)}
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

            <DraggableFlatList
              data={editingSong.tracks}
              onDragEnd={({ data }) => reorderTracks(data)}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item: track, drag, isActive }: RenderItemParams<EditSongForm['tracks'][0]>) => {
                const index = editingSong.tracks.findIndex(t => t.id === track.id);
                return (
                  <ScaleDecorator>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onLongPress={drag}
                      disabled={isActive}
                      delayPressIn={100}
                      delayLongPress={2000}
                      style={[
                        styles.trackUploadContainer,
                        isActive && (styles as any).trackUploadContainerActive
                      ]}
                    >
                      <View style={styles.trackHeader}>
                        <TouchableOpacity
                          onPress={drag}
                          style={(styles as any).dragHandle}
                        >
                          <Ionicons name="reorder-three-outline" size={24} color="#BB86FC" />
                        </TouchableOpacity>
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
                  </TouchableOpacity>
                </ScaleDecorator>
                );
              }}
            />
            
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
              <DraggableFlatList
                data={editingSong.scores}
                onDragEnd={({ data }) => reorderScores(data)}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item: score, drag, isActive }: RenderItemParams<Score>) => {
                  const index = editingSong.scores.findIndex(s => s.id === score.id);
                  const pages = getScorePages(score);
                  const pageCount = pages.length;
                  const hasPages = pageCount > 0;
                  const isUploading = score.url === 'uploading' || (score.pages && score.pages.some((p: string) => p === 'uploading'));
                  
                  return (
                    <ScaleDecorator>
                      <View
                        style={[
                          styles.scoreItemContainer,
                          isActive && (styles as any).trackUploadContainerActive
                        ]}
                      >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onLongPress={drag}
                        disabled={isActive}
                        delayPressIn={100}
                        delayLongPress={2000}
                        style={styles.scoreItem}
                      >
                        <TouchableOpacity
                          onPress={drag}
                          style={(styles as any).dragHandle}
                        >
                          <Ionicons name="reorder-three-outline" size={24} color="#BB86FC" />
                        </TouchableOpacity>
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
                          {hasPages && !isUploading && (
                            <Text style={styles.pageCountText}>
                              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                            </Text>
                          )}
                          {isUploading && (
                            <ActivityIndicator size="small" color="#BB86FC" style={{ marginHorizontal: 8 }} />
                          )}
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
                      </TouchableOpacity>
                        {hasPages && !isUploading && (
                          <View style={styles.pagesListContainer}>
                            {pages.map((pageUrl, pageIndex) => (
                              <View key={pageIndex} style={styles.pageItemRow}>
                                <Text style={styles.pageItemText}>Page {pageIndex + 1}</Text>
                                <TouchableOpacity
                                  style={styles.removePageButton}
                                  onPress={() => {
                                    Alert.alert(
                                      'Remove Page',
                                      `Are you sure you want to remove page ${pageIndex + 1}?`,
                                      [
                                        {
                                          text: 'Cancel',
                                          style: 'cancel'
                                        },
                                        {
                                          text: 'Remove',
                                          style: 'destructive',
                                          onPress: () => {
                                            setEditingSong(prev => {
                                              if (!prev) return null;
                                              const newScores = [...prev.scores];
                                              if (newScores[index].pages) {
                                                const updatedPages = newScores[index].pages!.filter((_, i) => i !== pageIndex);
                                                // If only one page left, convert back to url format
                                                if (updatedPages.length === 1) {
                                                  const { pages, ...scoreWithoutPages } = newScores[index];
                                                  newScores[index] = {
                                                    ...scoreWithoutPages,
                                                    url: updatedPages[0]
                                                  };
                                                } else {
                                                  newScores[index] = {
                                                    ...newScores[index],
                                                    pages: updatedPages
                                                  };
                                                }
                                              } else if (newScores[index].url) {
                                                // If it was a single page score, remove it entirely
                                                const { url, ...scoreWithoutUrl } = newScores[index];
                                                newScores[index] = scoreWithoutUrl as Score;
                                              }
                                              return { ...prev, scores: newScores };
                                            });
                                          }
                                        }
                                      ]
                                    );
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={18} color="#FF5252" />
                                </TouchableOpacity>
                              </View>
                            ))}
                            <TouchableOpacity
                              style={styles.addPageButton}
                              onPress={async () => {
                                try {
                                  const result = await DocumentPicker.getDocumentAsync({
                                    type: ['image/*'],
                                    copyToCacheDirectory: true
                                  });
                                  
                                  if (result.assets && result.assets[0]) {
                                    const file = result.assets[0];
                                    const currentPages = pages;
                                    
                                    // Add uploading placeholder
                                    setEditingSong(prev => {
                                      if (!prev) return null;
                                      const newScores = [...prev.scores];
                                      if (newScores[index].pages) {
                                        newScores[index] = {
                                          ...newScores[index],
                                          pages: [...currentPages, 'uploading']
                                        };
                                      } else if (newScores[index].url) {
                                        newScores[index] = {
                                          ...newScores[index],
                                          pages: [currentPages[0], 'uploading']
                                        };
                                        delete (newScores[index] as any).url;
                                      }
                                      return { ...prev, scores: newScores };
                                    });

                                    try {
                                      // Upload the new page
                                      const downloadURL = await uploadSheetMusic(file, `${score.name}_page${pageCount + 1}`, editingSong.title);
                                      
                                      // Update the score with the new page URL
                                      setEditingSong(prev => {
                                        if (!prev) return null;
                                        const newScores = [...prev.scores];
                                        if (newScores[index].pages) {
                                          const updatedPages = [...newScores[index].pages!];
                                          const uploadingIndex = updatedPages.indexOf('uploading');
                                          if (uploadingIndex !== -1) {
                                            updatedPages[uploadingIndex] = downloadURL;
                                          }
                                          newScores[index] = {
                                            ...newScores[index],
                                            pages: updatedPages
                                          };
                                        }
                                        return { ...prev, scores: newScores };
                                      });
                                    } catch (uploadError) {
                                      console.error('Error uploading page:', uploadError);
                                      Alert.alert('Error', 'Failed to upload page');
                                      // Remove the uploading placeholder
                                      setEditingSong(prev => {
                                        if (!prev) return null;
                                        const newScores = [...prev.scores];
                                        if (newScores[index].pages) {
                                          newScores[index] = {
                                            ...newScores[index],
                                            pages: newScores[index].pages!.filter((p: string) => p !== 'uploading')
                                          };
                                        }
                                        return { ...prev, scores: newScores };
                                      });
                                    }
                                  }
                                } catch (error: any) {
                                  if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
                                    console.error('Error selecting file:', error);
                                    Alert.alert('Error', 'Failed to select file');
                                  }
                                }
                              }}
                            >
                              <Ionicons name="add-circle-outline" size={20} color="#BB86FC" />
                              <Text style={styles.addPageButtonText}>Add Page</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </ScaleDecorator>
                  );
                }}
              />
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: ['image/*'], // Only images, no PDFs
                      copyToCacheDirectory: true
                    });
                    
                    if (result.assets && result.assets[0]) {
                      const file = result.assets[0];
                      const scoreName = file.name.split('.')[0];
                      
                      // Show loading state
                      const scoreId = generateId();
                      setEditingSong(prev => {
                        if (!prev) return null;
                        const newScore: Score = {
                          id: scoreId,
                          name: scoreName,
                          url: 'uploading'
                        };
                        return {
                          ...prev,
                          scores: [...prev.scores, newScore]
                        };
                      });

                      try {
                        // Upload single image file
                      const downloadURL = await uploadSheetMusic(file, scoreName, editingSong.title);
                      
                      // Update the score with the download URL
                      setEditingSong(prev => {
                        if (!prev) return null;
                        const newScores = prev.scores.map(score => 
                            score.id === scoreId && score.url === 'uploading' ? { ...score, url: downloadURL } : score
                        );
                        return { ...prev, scores: newScores };
                      });
                      } catch (uploadError) {
                        console.error('Error uploading score:', uploadError);
                    Alert.alert('Error', 'Failed to upload score');
                        // Remove the failed score
                    setEditingSong(prev => {
                      if (!prev) return null;
                          return { ...prev, scores: prev.scores.filter(score => score.id !== scoreId) };
                        });
                      }
                    }
                  } catch (error: any) {
                    // User cancelled or error occurred
                    if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
                      console.error('Error selecting file:', error);
                      Alert.alert('Error', 'Failed to select file');
                    }
                  }
                }}
              >
                <Text style={styles.uploadButtonText}>Add Score</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.lyricsSection}>
              <Text style={styles.sectionTitle}>Links</Text>
              <DraggableFlatList
                data={editingSong.resources}
                onDragEnd={({ data }) => reorderResources(data)}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item: resource, drag, isActive }: RenderItemParams<Resource>) => {
                  const index = editingSong.resources.findIndex(r => r.id === resource.id);
                  return (
                    <ScaleDecorator>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onLongPress={drag}
                        disabled={isActive}
                        delayPressIn={100}
                        delayLongPress={2000}
                        style={[
                          styles.resourceItemContainer,
                          isActive && (styles as any).trackUploadContainerActive
                        ]}
                      >
                        <View style={styles.resourceDragHandleContainer}>
                          <TouchableOpacity
                            onPress={drag}
                            style={(styles as any).dragHandle}
                          >
                            <Ionicons name="reorder-three-outline" size={24} color="#BB86FC" />
                          </TouchableOpacity>
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
                        </View>
                        <View style={styles.resourceTypeContainer}>
                          <Text style={styles.resourceTypeLabel}>Type:</Text>
                          <View style={styles.resourceTypeButtons}>
                            {['youtube', 'audio', 'download', 'link', 'pdf'].map((type) => (
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
                                  {type === 'youtube' ? 'Video' : type === 'audio' ? 'Audio' : type === 'pdf' ? 'PDF' : type.charAt(0).toUpperCase() + type.slice(1)}
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
                      </TouchableOpacity>
                    </ScaleDecorator>
                  );
                }}
              />
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
        setCurrentFilteredIndex(-1);
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
      <KeyboardAvoidingView 
        style={styles.songPasswordModalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
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
      </KeyboardAvoidingView>
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

  // Upload multiple sheet music files and return array of URLs
  const uploadMultipleSheetMusic = async (files: DocumentPicker.DocumentPickerAsset[], baseFileName: string, songTitle: string): Promise<string[]> => {
    try {
      const uploadPromises = files.map(async (file, index) => {
        const storage = getStorage();
        const fileExtension = file.name.split('.').pop();
        const safeSongTitle = songTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
        // Add index to filename if multiple files to avoid conflicts
        const fileName = files.length > 1 
          ? `${baseFileName}_page${index + 1}` 
          : baseFileName;
        const filePath = `sheet_music/${safeSongTitle}_${fileName}.${fileExtension}`;
        const fileRef = storageRef(storage, filePath);

        const response = await fetch(file.uri);
        const blob = await response.blob();
        await uploadBytes(fileRef, blob);
        return await getDownloadURL(fileRef);
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple sheet music files:', error);
      throw new Error('Failed to upload sheet music files');
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

      // Clean scores to remove undefined values (Firebase doesn't accept undefined)
      const cleanedScores = (newSong.scores || []).map(score => {
        const cleaned: any = { id: score.id, name: score.name };
        if (score.url !== undefined) cleaned.url = score.url;
        if (score.pages !== undefined && score.pages !== null) cleaned.pages = score.pages;
        return cleaned;
      });

      // Create new song object
      const songToAdd: Song = {
        id: newId,
        title: newSong.title,
        artist: newSong.artist,
        album: newSong.album || undefined,
        tracks,
        lyrics: newSong.lyrics,
        scores: cleanedScores as Score[],
        resources: newSong.resources,
        createdBy: user?.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Prepare data for Firebase (remove undefined values)
      const songData = {
        title: songToAdd.title,
        artist: songToAdd.artist,
        album: songToAdd.album,
        tracks: songToAdd.tracks,
        lyrics: songToAdd.lyrics,
        scores: cleanedScores,
        resources: songToAdd.resources,
        createdBy: songToAdd.createdBy,
        createdAt: songToAdd.createdAt?.toISOString(),
        updatedAt: songToAdd.updatedAt?.toISOString()
      };

      // Remove undefined values before saving to Firebase
      const cleanedSongData = removeUndefinedValues(songData);

      // Add to Firebase
      const songRef = ref(database, `songs/${newId}`);
      await set(songRef, cleanedSongData);

      // Reset form and close dialog
      setNewSong({
        title: '',
        artist: '',
        album: '',
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
          <TextInput
            style={styles.dialogInput}
            placeholder="Album (optional)"
            placeholderTextColor="#666666"
            value={newSong.album || ''}
            onChangeText={(text) => setNewSong(prev => ({ ...prev, album: text }))}
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
              {newSong.scores.map((score, index) => {
                const pages = getScorePages(score);
                const pageCount = pages.length;
                const hasPages = pageCount > 0;
                const isUploading = score.url === 'uploading' || (score.pages && score.pages.some((p: string) => p === 'uploading'));
                
                return (
                  <View key={score.id} style={styles.scoreItemContainer}>
                    <View style={styles.scoreItem}>
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
                      {hasPages && !isUploading && (
                        <Text style={styles.pageCountText}>
                          {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        </Text>
                      )}
                      {isUploading && (
                        <ActivityIndicator size="small" color="#BB86FC" style={{ marginHorizontal: 8 }} />
                      )}
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
                    {hasPages && !isUploading && (
                      <View style={styles.pagesListContainer}>
                        {pages.map((pageUrl, pageIndex) => (
                          <View key={pageIndex} style={styles.pageItemRow}>
                            <Text style={styles.pageItemText}>Page {pageIndex + 1}</Text>
                            <TouchableOpacity
                              style={styles.removePageButton}
                              onPress={() => {
                                Alert.alert(
                                  'Remove Page',
                                  `Are you sure you want to remove page ${pageIndex + 1}?`,
                                  [
                                    {
                                      text: 'Cancel',
                                      style: 'cancel'
                                    },
                                    {
                                      text: 'Remove',
                                      style: 'destructive',
                                      onPress: () => {
                                        setNewSong(prev => {
                                          const newScores = [...prev.scores];
                                          if (newScores[index].pages) {
                                            const updatedPages = newScores[index].pages!.filter((_, i) => i !== pageIndex);
                                            // If only one page left, convert back to url format
                                            if (updatedPages.length === 1) {
                                              const { pages, ...scoreWithoutPages } = newScores[index];
                                              newScores[index] = {
                                                ...scoreWithoutPages,
                                                url: updatedPages[0]
                                              };
                                            } else {
                                              newScores[index] = {
                                                ...newScores[index],
                                                pages: updatedPages
                                              };
                                            }
                                          } else if (newScores[index].url) {
                                            // If it was a single page score, remove it entirely
                                            const { url, ...scoreWithoutUrl } = newScores[index];
                                            newScores[index] = scoreWithoutUrl as Score;
                                          }
                                          return { ...prev, scores: newScores };
                                        });
                                      }
                                    }
                                  ]
                                );
                              }}
                            >
                              <Ionicons name="trash-outline" size={18} color="#FF5252" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addPageButton}
                          onPress={async () => {
                            try {
                              const result = await DocumentPicker.getDocumentAsync({
                                type: ['image/*'],
                                copyToCacheDirectory: true
                              });
                              
                              if (result.assets && result.assets[0]) {
                                const file = result.assets[0];
                                const currentPages = pages;
                                
                                // Add uploading placeholder
                                setNewSong(prev => {
                                  const newScores = [...prev.scores];
                                  if (newScores[index].pages) {
                                    newScores[index] = {
                                      ...newScores[index],
                                      pages: [...currentPages, 'uploading']
                                    };
                                  } else if (newScores[index].url) {
                                    newScores[index] = {
                                      ...newScores[index],
                                      pages: [currentPages[0], 'uploading']
                                    };
                                    delete (newScores[index] as any).url;
                                  }
                                  return { ...prev, scores: newScores };
                                });

                                try {
                                  // Upload the new page
                                  const downloadURL = await uploadSheetMusic(file, `${score.name}_page${pageCount + 1}`, newSong.title);
                                  
                                  // Update the score with the new page URL
                                  setNewSong(prev => {
                                    const newScores = [...prev.scores];
                                    if (newScores[index].pages) {
                                      const updatedPages = [...newScores[index].pages!];
                                      const uploadingIndex = updatedPages.indexOf('uploading');
                                      if (uploadingIndex !== -1) {
                                        updatedPages[uploadingIndex] = downloadURL;
                                      }
                                      newScores[index] = {
                                        ...newScores[index],
                                        pages: updatedPages
                                      };
                                    }
                                    return { ...prev, scores: newScores };
                                  });
                                } catch (uploadError) {
                                  console.error('Error uploading page:', uploadError);
                                  Alert.alert('Error', 'Failed to upload page');
                                  // Remove the uploading placeholder
                                  setNewSong(prev => {
                                    const newScores = [...prev.scores];
                                    if (newScores[index].pages) {
                                      newScores[index] = {
                                        ...newScores[index],
                                        pages: newScores[index].pages!.filter((p: string) => p !== 'uploading')
                                      };
                                    }
                                    return { ...prev, scores: newScores };
                                  });
                                }
                              }
                            } catch (error: any) {
                              if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
                                console.error('Error selecting file:', error);
                                Alert.alert('Error', 'Failed to select file');
                              }
                            }
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={20} color="#BB86FC" />
                          <Text style={styles.addPageButtonText}>Add Page</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={async () => {
                try {
                  const result = await DocumentPicker.getDocumentAsync({
                    type: ['image/*'], // Only images, no PDFs
                    copyToCacheDirectory: true
                  });
                  
                  if (result.assets && result.assets[0]) {
                    const file = result.assets[0];
                    const scoreName = file.name.split('.')[0];
                    
                    // Show loading state
                    const scoreId = generateId();
                    setNewSong(prev => {
                      const newScore: Score = {
                        id: scoreId,
                        name: scoreName,
                        url: 'uploading'
                      };
                      return {
                        ...prev,
                        scores: [...prev.scores, newScore]
                      };
                    });

                    try {
                      // Upload single image file
                    const downloadURL = await uploadSheetMusic(file, scoreName, newSong.title);
                    
                    // Update the score with the download URL
                    setNewSong(prev => {
                      const newScores = prev.scores.map(score => 
                          score.id === scoreId && score.url === 'uploading' ? { ...score, url: downloadURL } : score
                      );
                      return { ...prev, scores: newScores };
                    });
                    } catch (uploadError) {
                      console.error('Error uploading score:', uploadError);
                  Alert.alert('Error', 'Failed to upload score');
                      // Remove the failed score
                  setNewSong(prev => {
                        return { ...prev, scores: prev.scores.filter(score => score.id !== scoreId) };
                      });
                    }
                  }
                } catch (error: any) {
                  // User cancelled or error occurred
                  if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
                    console.error('Error selecting file:', error);
                    Alert.alert('Error', 'Failed to select file');
                  }
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
                      {['youtube', 'audio', 'download', 'link', 'pdf'].map((type) => (
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
                            {type === 'youtube' ? 'Video' : type === 'audio' ? 'Audio' : type === 'pdf' ? 'PDF' : type.charAt(0).toUpperCase() + type.slice(1)}
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

  // Helper function to get pages from a score (backward compatible)
  const getScorePages = (score: Score): string[] => {
    if (score.pages && score.pages.length > 0) {
      return score.pages;
    }
    if (score.url) {
      return [score.url];
    }
    return [];
  };

  // Helper function to check if score is PDF
  const isScorePDF = (score: Score): boolean => {
    const pages = getScorePages(score);
    return pages.length > 0 && pages[0].endsWith('.pdf');
  };

  // Navigate to next/previous page for a score
  const navigateScorePage = (scoreId: string, direction: 'next' | 'prev', totalPages: number) => {
    setScorePageIndices(prev => {
      const currentIndex = prev[scoreId] || 0;
      let newIndex = currentIndex;
      if (direction === 'next') {
        newIndex = Math.min(currentIndex + 1, totalPages - 1);
      } else {
        newIndex = Math.max(currentIndex - 1, 0);
      }
      // Scroll the ScrollView to the new page
      const scrollRef = scoreScrollRefs.current[scoreId];
      if (scrollRef) {
        const pageWidth = Dimensions.get('window').width - 48;
        scrollRef.scrollTo({ x: newIndex * pageWidth, animated: true });
      }
      return { ...prev, [scoreId]: newIndex };
    });
  };

  // Navigate fullscreen page
  const navigateFullScreenPage = (direction: 'next' | 'prev') => {
    if (!fullScreenImage || !fullScreenImage.pages) return;
    const totalPages = fullScreenImage.pages.length;
    const currentIndex = fullScreenPageIndex;
    let newIndex = currentIndex;
    if (direction === 'next') {
      newIndex = Math.min(currentIndex + 1, totalPages - 1);
    } else {
      newIndex = Math.max(currentIndex - 1, 0);
    }
    setFullScreenPageIndex(newIndex);
    // Scroll the ScrollView to the new page
    if (fullScreenScrollRef.current) {
      const pageWidth = Dimensions.get('window').width;
      fullScreenScrollRef.current.scrollTo({ x: newIndex * pageWidth, animated: true });
    }
  };

  // Zoom control functions - using smaller increments for finer control
  const handleZoomIn = () => {
    const newScale = Math.min(MAX_ZOOM, imageScaleRef.current + ZOOM_INCREMENT);
    imageScaleRef.current = newScale;
    
    // Animate the scale change smoothly
    Animated.timing(imageScaleAnimated, {
      toValue: newScale,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setImageScale(newScale);
    });
    // Update state immediately for button disabled state
    setImageScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(MIN_ZOOM, imageScaleRef.current - ZOOM_INCREMENT);
    imageScaleRef.current = newScale;
    
    // Animate the scale change smoothly
    Animated.timing(imageScaleAnimated, {
      toValue: newScale,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setImageScale(newScale);
    });
    // Update state immediately for button disabled state
    setImageScale(newScale);
  };

  const handleResetZoom = () => {
    imageScaleRef.current = 1;
    imageTranslateXRef.current = 0;
    imageTranslateYRef.current = 0;
    
    // Animate the reset smoothly
    Animated.parallel([
      Animated.timing(imageScaleAnimated, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setImageScale(1);
      setImageTranslateX(0);
      setImageTranslateY(0);
    });
    setImageScale(1); // Update immediately for button state
    setImageTranslateX(0);
    setImageTranslateY(0);
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
                {isAdminMode && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddTrack}
                  >
                    <Ionicons name="add-circle" size={24} color="#BB86FC" />
                    <Text style={styles.addButtonText}>Add Track</Text>
                  </TouchableOpacity>
                )}
                {isAdminMode ? (
                  <DraggableFlatList
                    data={selectedSong.tracks || []}
                    onDragEnd={({ data }) => reorderSongTracks(data)}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item: track, drag, isActive }: RenderItemParams<Track>) => (
                      <ScaleDecorator>
                        <TouchableOpacity 
                          activeOpacity={0.7}
                          onLongPress={drag}
                          disabled={isActive}
                          style={[
                            styles.trackContainer,
                            isLandscape && styles.trackContainerLandscape,
                            isActive && (styles as any).trackUploadContainerActive
                          ]}
                          onPress={() => !isActive && editingTrackId !== track.id && handleTrackClick(track.id)}
                        >
                          {isAdminMode && (
                            <TouchableOpacity
                              onPress={drag}
                              style={(styles as any).dragHandle}
                            >
                              <Ionicons name="reorder-three-outline" size={20} color="#BB86FC" />
                            </TouchableOpacity>
                          )}
                          <View style={styles.trackInfo}>
                            {editingTrackId === track.id ? (
                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                  style={[styles.trackNameInput, { flex: 1, marginRight: 8 }]}
                                  value={editingTrackName}
                                  onChangeText={setEditingTrackName}
                                  placeholder="Track name"
                                  placeholderTextColor="#666666"
                                  autoFocus
                                />
                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={() => {
                                    if (editingTrackName.trim()) {
                                      handleUpdateTrackName(track.id, editingTrackName);
                                    }
                                  }}
                                >
                                  <Ionicons name="checkmark-outline" size={24} color="#4CAF50" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.iconButton}
                                  onPress={() => {
                                    setEditingTrackId(null);
                                    setEditingTrackName('');
                                  }}
                                >
                                  <Ionicons name="close-outline" size={24} color="#FF5252" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={styles.trackName}>{track.name}</Text>
                            )}
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
                          {isAdminMode && editingTrackId !== track.id && (
                            <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                              <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => {
                                  setEditingTrackId(track.id);
                                  setEditingTrackName(track.name);
                                }}
                              >
                                <Ionicons name="create-outline" size={20} color="#BB86FC" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => handleDeleteTrack(track.id)}
                              >
                                <Ionicons name="trash-outline" size={20} color="#FF5252" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </TouchableOpacity>
                      </ScaleDecorator>
                    )}
                  />
                ) : (
                  (selectedSong.tracks || []).map(track => (
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
                  ))
                )}
              </View>
            ) : activeView === 'lyrics' ? (
              // Lyrics view content
              <View style={styles.lyricsContainer}>
                <View style={styles.lyricsHeader}>
                  <View style={styles.lyricsHeaderLeft}>
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
                  {!isLyricsEditing && (
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => setIsLyricsFullscreen(true)}
                    >
                      <Ionicons name="expand-outline" size={24} color="#BB86FC" />
                    </TouchableOpacity>
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
                  <View style={styles.lyricsScrollView}>
                    <GestureDetector
                      gesture={Gesture.Simultaneous(
                        Gesture.Pinch()
                          .onStart(() => {
                            lyricsLastScaleRef.current = 1.0;
                          })
                          .onUpdate((e) => {
                            const scaleChange = e.scale / lyricsLastScaleRef.current;
                            const newScale = Math.max(0.5, Math.min(5.0, lyricsZoomScaleRef.current * scaleChange));
                            lyricsLastScaleRef.current = e.scale;
                            lyricsZoomScaleRef.current = newScale;
                            runOnJS(setLyricsZoomScale)(newScale);
                          })
                          .onEnd(() => {
                            lyricsLastScaleRef.current = 1.0;
                          }),
                        Gesture.Pan()
                          .minPointers(1)
                          .maxPointers(2)
                          .onStart(() => {
                            lyricsLastPanXRef.current = lyricsTranslateXRef.current;
                            lyricsLastPanYRef.current = lyricsTranslateYRef.current;
                          })
                          .onUpdate((e) => {
                            const newX = lyricsLastPanXRef.current + e.translationX;
                            const newY = lyricsLastPanYRef.current + e.translationY;
                            lyricsTranslateXRef.current = newX;
                            lyricsTranslateYRef.current = newY;
                            runOnJS(setLyricsTranslateX)(newX);
                            runOnJS(setLyricsTranslateY)(newY);
                          })
                          .onEnd(() => {
                            // Keep the current translation values
                          })
                      )}
                    >
                      <ScrollView
                        style={styles.lyricsScrollView}
                        contentContainerStyle={styles.lyricsScrollContent}
                        showsHorizontalScrollIndicator={lyricsZoomScale > 1.0}
                        showsVerticalScrollIndicator={lyricsZoomScale > 1.0}
                        scrollEnabled={false}
                        bounces={false}
                      >
                        <View
                          style={[
                            styles.lyricsContent,
                            {
                              transform: [
                                { translateX: lyricsTranslateX },
                                { translateY: lyricsTranslateY },
                                { scale: lyricsZoomScale },
                              ],
                            },
                          ]}
                        >
                          <Markdown style={markdownStyles}>
                            {selectedSong.lyrics || ''}
                          </Markdown>
                        </View>
                      </ScrollView>
                    </GestureDetector>
                  </View>
                )}
              </View>
            ) : activeView === 'score' ? (
              // Scores view content
              <View style={styles.sheetMusicContainer}>
                {isAdminMode && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddScore}
                  >
                    <Ionicons name="add-circle" size={24} color="#BB86FC" />
                    <Text style={styles.addButtonText}>Add Score</Text>
                  </TouchableOpacity>
                )}
                {isAdminMode ? (
                  <DraggableFlatList
                    data={selectedSong.scores || []}
                    onDragEnd={({ data }) => reorderSongScores(data)}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item: score, drag, isActive }: RenderItemParams<Score>) => (
                      <ScaleDecorator>
                        <View 
                          style={[
                            styles.scoreView,
                            isActive && (styles as any).trackUploadContainerActive
                          ]}
                        >
                          <View style={styles.scoreHeader}>
                            {isAdminMode && (
                              <TouchableOpacity
                                onPress={drag}
                                style={(styles as any).dragHandle}
                              >
                                <Ionicons name="reorder-three-outline" size={20} color="#BB86FC" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                              onPress={() => toggleScoreExpansion(score.id)}
                            >
                              {editingScoreId === score.id ? (
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                                  <TextInput
                                    style={[styles.dialogInput, { flex: 1, marginRight: 8 }]}
                                    value={editingScoreName}
                                    onChangeText={setEditingScoreName}
                                    placeholder="Score name"
                                    placeholderTextColor="#666666"
                                    autoFocus
                                  />
                                  <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => {
                                      if (editingScoreName.trim()) {
                                        handleUpdateScoreName(score.id, editingScoreName);
                                      }
                                    }}
                                  >
                                    <Ionicons name="checkmark-outline" size={20} color="#4CAF50" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => {
                                      setEditingScoreId(null);
                                      setEditingScoreName('');
                                    }}
                                  >
                                    <Ionicons name="close-outline" size={20} color="#FF5252" />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <Text style={styles.scoreTitle}>{score.name}</Text>
                              )}
                              {editingScoreId !== score.id && (
                                <>
                                  <Ionicons
                                    name={expandedScores[score.id] ? "chevron-up" : "chevron-down"}
                                    size={24}
                                    color="#BB86FC"
                                  />
                                  {isAdminMode && (
                                    <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                                      <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => {
                                          setEditingScoreId(score.id);
                                          setEditingScoreName(score.name);
                                        }}
                                      >
                                        <Ionicons name="create-outline" size={20} color="#BB86FC" />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.iconButton}
                                        onPress={() => handleDeleteScore(score.id)}
                                      >
                                        <Ionicons name="trash-outline" size={20} color="#FF5252" />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                          {expandedScores[score.id] && (() => {
                            const pages = getScorePages(score);
                            const currentPageIndex = scorePageIndices[score.id] || 0;
                            const isPDF = isScorePDF(score);
                            const hasMultiplePages = pages.length > 1;

                            if (isPDF) {
                              // PDF handling - WebView already supports page navigation
                              const pdfUrl = pages[0];
                              return (
                              <View style={styles.sheetMusicView}>
                                <WebView
                                  source={{ 
                                      uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
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
                                              Linking.openURL(pdfUrl);
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
                              );
                            } else {
                              // Image handling with multi-page support
                              return (
                                <View style={styles.scorePagesContainer}>
                                  {hasMultiplePages && (
                                    <View style={styles.scorePageControls}>
                              <TouchableOpacity
                                        style={[
                                          styles.scorePageButton,
                                          currentPageIndex === 0 && styles.scorePageButtonDisabled
                                        ]}
                                        onPress={() => navigateScorePage(score.id, 'prev', pages.length)}
                                        disabled={currentPageIndex === 0}
                                      >
                                        <Ionicons name="chevron-back" size={24} color={currentPageIndex === 0 ? "#666" : "#BB86FC"} />
                                      </TouchableOpacity>
                                      <Text style={styles.scorePageIndicator}>
                                        {currentPageIndex + 1} / {pages.length}
                                      </Text>
                                      <TouchableOpacity
                                        style={[
                                          styles.scorePageButton,
                                          currentPageIndex === pages.length - 1 && styles.scorePageButtonDisabled
                                        ]}
                                        onPress={() => navigateScorePage(score.id, 'next', pages.length)}
                                        disabled={currentPageIndex === pages.length - 1}
                                      >
                                        <Ionicons name="chevron-forward" size={24} color={currentPageIndex === pages.length - 1 ? "#666" : "#BB86FC"} />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                  <ScrollView
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    ref={(ref) => {
                                      scoreScrollRefs.current[score.id] = ref;
                                    }}
                                    onScroll={(event) => {
                                      const offsetX = event.nativeEvent.contentOffset.x;
                                      const pageWidth = Dimensions.get('window').width - 48;
                                      const pageIndex = Math.round(offsetX / pageWidth);
                                      if (pageIndex !== currentPageIndex && pageIndex >= 0 && pageIndex < pages.length) {
                                        setScorePageIndices(prev => ({ ...prev, [score.id]: pageIndex }));
                                      }
                                    }}
                                    scrollEventThrottle={16}
                                    contentContainerStyle={styles.scorePagesScrollContent}
                                  >
                                    {pages.map((pageUrl, index) => (
                                      <TouchableOpacity
                                        key={index}
                                        onPress={() => setFullScreenImage({ 
                                          url: pageUrl, 
                                          name: score.name,
                                          pages: pages,
                                          currentPageIndex: index
                                        })}
                                activeOpacity={0.8}
                                        style={styles.scorePageItem}
                              >
                                <Image
                                          source={{ uri: pageUrl }}
                                  style={styles.sheetMusicImage}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              );
                            }
                          })()}
                        </View>
                      </ScaleDecorator>
                    )}
                  />
                ) : (
                  selectedSong.scores?.map((score, index) => (
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
                      {expandedScores[score.id] && (() => {
                        const pages = getScorePages(score);
                        const currentPageIndex = scorePageIndices[score.id] || 0;
                        const isPDF = isScorePDF(score);
                        const hasMultiplePages = pages.length > 1;

                        if (isPDF) {
                          // PDF handling - WebView already supports page navigation
                          const pdfUrl = pages[0];
                          return (
                          <View style={styles.sheetMusicView}>
                            <WebView
                              source={{ 
                                  uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
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
                                          Linking.openURL(pdfUrl);
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
                          );
                        } else {
                          // Image handling with multi-page support
                          const currentPageUrl = pages[currentPageIndex];
                          return (
                            <View style={styles.scorePagesContainer}>
                              {hasMultiplePages && (
                                <View style={styles.scorePageControls}>
                          <TouchableOpacity
                                    style={[
                                      styles.scorePageButton,
                                      currentPageIndex === 0 && styles.scorePageButtonDisabled
                                    ]}
                                    onPress={() => navigateScorePage(score.id, 'prev', pages.length)}
                                    disabled={currentPageIndex === 0}
                                  >
                                    <Ionicons name="chevron-back" size={24} color={currentPageIndex === 0 ? "#666" : "#BB86FC"} />
                                  </TouchableOpacity>
                                  <Text style={styles.scorePageIndicator}>
                                    {currentPageIndex + 1} / {pages.length}
                                  </Text>
                                  <TouchableOpacity
                                    style={[
                                      styles.scorePageButton,
                                      currentPageIndex === pages.length - 1 && styles.scorePageButtonDisabled
                                    ]}
                                    onPress={() => navigateScorePage(score.id, 'next', pages.length)}
                                    disabled={currentPageIndex === pages.length - 1}
                                  >
                                    <Ionicons name="chevron-forward" size={24} color={currentPageIndex === pages.length - 1 ? "#666" : "#BB86FC"} />
                                  </TouchableOpacity>
                                </View>
                              )}
                              <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                ref={(ref) => {
                                  scoreScrollRefs.current[score.id] = ref;
                                }}
                                onScroll={(event) => {
                                  const offsetX = event.nativeEvent.contentOffset.x;
                                  const pageWidth = Dimensions.get('window').width - 48;
                                  const pageIndex = Math.round(offsetX / pageWidth);
                                  if (pageIndex !== currentPageIndex && pageIndex >= 0 && pageIndex < pages.length) {
                                    setScorePageIndices(prev => ({ ...prev, [score.id]: pageIndex }));
                                  }
                                }}
                                scrollEventThrottle={16}
                                contentContainerStyle={styles.scorePagesScrollContent}
                              >
                                {pages.map((pageUrl, index) => (
                                  <TouchableOpacity
                                    key={index}
                                    onPress={() => setFullScreenImage({ 
                                      url: pageUrl, 
                                      name: score.name,
                                      pages: pages,
                                      currentPageIndex: index
                                    })}
                            activeOpacity={0.8}
                                    style={styles.scorePageItem}
                          >
                            <Image
                                      source={{ uri: pageUrl }}
                              style={styles.sheetMusicImage}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                                ))}
                              </ScrollView>
                            </View>
                          );
                        }
                      })()}
                    </View>
                  ))
                )}
              </View>
            ) : (
              // Resources view content
              <View style={styles.sheetMusicContainer}>
                {isAdminMode && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddResource}
                  >
                    <Ionicons name="add-circle" size={24} color="#BB86FC" />
                    <Text style={styles.addButtonText}>Add Resource</Text>
                  </TouchableOpacity>
                )}
                {isAdminMode ? (
                  <DraggableFlatList
                    data={selectedSong.resources || []}
                    onDragEnd={({ data }) => reorderSongResources(data)}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item: resource, drag, isActive }: RenderItemParams<Resource>) => (
                      <ScaleDecorator>
                        <View 
                          style={[
                            styles.scoreView,
                            isActive && (styles as any).trackUploadContainerActive
                          ]}
                        >
                          <View style={styles.scoreHeader}>
                            {isAdminMode && (
                              <TouchableOpacity
                                onPress={drag}
                                style={(styles as any).dragHandle}
                              >
                                <Ionicons name="reorder-three-outline" size={20} color="#BB86FC" />
                              </TouchableOpacity>
                            )}
                            {editingResourceId === resource.id ? (
                              <View style={{ flex: 1, padding: 8 }}>
                                <TextInput
                                  style={[styles.dialogInput, { marginBottom: 8 }]}
                                  value={editingResourceName}
                                  onChangeText={setEditingResourceName}
                                  placeholder="Resource name"
                                  placeholderTextColor="#666666"
                                  autoFocus
                                />
                                <TextInput
                                  style={[styles.dialogInput, { marginBottom: 8 }]}
                                  value={editingResourceUrl}
                                  onChangeText={setEditingResourceUrl}
                                  placeholder="URL"
                                  placeholderTextColor="#666666"
                                />
                                <TextInput
                                  style={[styles.dialogInput, { marginBottom: 8 }]}
                                  value={editingResourceDescription}
                                  onChangeText={setEditingResourceDescription}
                                  placeholder="Description (optional)"
                                  placeholderTextColor="#666666"
                                />
                                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                  {['youtube', 'audio', 'download', 'link', 'pdf'].map((type) => (
                                    <TouchableOpacity
                                      key={type}
                                      style={[
                                        styles.resourceTypeButton,
                                        editingResourceType === type && styles.resourceTypeButtonActive
                                      ]}
                                      onPress={() => setEditingResourceType(type as any)}
                                    >
                                      <Text style={[
                                        styles.resourceTypeButtonText,
                                        editingResourceType === type && styles.resourceTypeButtonTextActive
                                      ]}>
                                        {type === 'youtube' ? 'Video' : type === 'audio' ? 'Audio' : type === 'pdf' ? 'PDF' : type.charAt(0).toUpperCase() + type.slice(1)}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                                  <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => {
                                      if (editingResourceName.trim() && editingResourceUrl.trim()) {
                                        handleUpdateResource();
                                      }
                                    }}
                                  >
                                    <Ionicons name="checkmark-outline" size={24} color="#4CAF50" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.iconButton}
                                    onPress={() => {
                                      if (editingResourceId === resource.id && !resource.name && !resource.url && selectedSong.resources) {
                                        // If it's a new resource, remove it
                                        const updatedResources = selectedSong.resources.filter(r => r.id !== resource.id);
                                        updateSongInFirebase({ resources: updatedResources });
                                      }
                                      setEditingResourceId(null);
                                      setEditingResourceName('');
                                      setEditingResourceUrl('');
                                      setEditingResourceDescription('');
                                      setEditingResourceType('link');
                                    }}
                                  >
                                    <Ionicons name="close-outline" size={24} color="#FF5252" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ) : (
                              <>
                                <TouchableOpacity
                                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
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
                                {isAdminMode && (
                                  <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                                    <TouchableOpacity
                                      style={styles.iconButton}
                                      onPress={() => {
                                        setEditingResourceId(resource.id);
                                        setEditingResourceName(resource.name);
                                        setEditingResourceUrl(resource.url);
                                        setEditingResourceDescription(resource.description || '');
                                        setEditingResourceType(resource.type);
                                      }}
                                    >
                                      <Ionicons name="create-outline" size={20} color="#BB86FC" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.iconButton}
                                      onPress={() => handleDeleteResource(resource.id)}
                                    >
                                      <Ionicons name="trash-outline" size={20} color="#FF5252" />
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </>
                            )}
                          </View>
                    {expandedResources[resource.id] && editingResourceId !== resource.id && (
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
                        ) : resource.type === 'audio' ? (
                          <View style={styles.sheetMusicView}>
                            <WebView
                              source={{ uri: resource.url }}
                              style={{
                                height: 150,
                                width: Dimensions.get('window').width - 48,
                                backgroundColor: '#000000',
                              }}
                              allowsFullscreenVideo={false}
                              javaScriptEnabled={true}
                              domStorageEnabled={true}
                            />
                          </View>
                        ) : resource.type === 'pdf' ? (
                          <View style={styles.sheetMusicView}>
                            <WebView
                              source={{ uri: resource.url }}
                              style={{
                                height: (Dimensions.get('window').width - 48) * 1.414, // A4 aspect ratio (297:210)
                                width: Dimensions.get('window').width - 48,
                                backgroundColor: '#000000',
                              }}
                              allowsFullscreenVideo={true}
                              javaScriptEnabled={true}
                              domStorageEnabled={true}
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
                      </ScaleDecorator>
                    )}
                  />
                ) : (
                  selectedSong.resources?.map((resource, index) => (
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
                          ) : resource.type === 'audio' ? (
                            <View style={styles.sheetMusicView}>
                              <WebView
                                source={{ uri: resource.url }}
                                style={{
                                  height: 150,
                                  width: Dimensions.get('window').width - 48,
                                  backgroundColor: '#000000',
                                }}
                                allowsFullscreenVideo={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                              />
                            </View>
                          ) : resource.type === 'pdf' ? (
                            <View style={styles.sheetMusicView}>
                              <WebView
                                source={{ uri: resource.url }}
                                style={{
                                  height: (Dimensions.get('window').width - 48) * 1.414, // A4 aspect ratio (297:210)
                                  width: Dimensions.get('window').width - 48,
                                  backgroundColor: '#000000',
                                }}
                                allowsFullscreenVideo={true}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
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
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderFullScreenImage = () => {
    if (!fullScreenImage) return null;

    const pages = fullScreenImage.pages || [fullScreenImage.url];
    const hasMultiplePages = pages.length > 1;
    const currentPageUrl = pages[fullScreenPageIndex] || fullScreenImage.url;

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
          setFullScreenPageIndex(0);
          imageScaleRef.current = 1;
          imageTranslateXRef.current = 0;
          imageTranslateYRef.current = 0;
          imageScaleAnimated.setValue(1);
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
              setFullScreenPageIndex(0);
              imageScaleRef.current = 1;
              imageTranslateXRef.current = 0;
              imageTranslateYRef.current = 0;
              imageScaleAnimated.setValue(1);
            }}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Zoom Controls */}
          <View style={styles.fullScreenZoomControls}>
            <TouchableOpacity
              style={[
                styles.fullScreenZoomButton,
                imageScale >= 8.0 && styles.fullScreenZoomButtonDisabled
              ]}
              onPress={handleZoomIn}
              disabled={imageScale >= 8.0}
            >
              <Ionicons name="add" size={24} color={imageScale >= 8.0 ? "#666" : "#FFFFFF"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fullScreenZoomButton,
                imageScale <= 0.3 && styles.fullScreenZoomButtonDisabled
              ]}
              onPress={handleZoomOut}
              disabled={imageScale <= 0.3}
            >
              <Ionicons name="remove" size={24} color={imageScale <= 0.3 ? "#666" : "#FFFFFF"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fullScreenZoomButton,
                Math.abs(imageScale - 1) < 0.01 && Math.abs(imageTranslateX) < 0.01 && Math.abs(imageTranslateY) < 0.01 && styles.fullScreenZoomButtonDisabled
              ]}
              onPress={handleResetZoom}
              disabled={Math.abs(imageScale - 1) < 0.01 && Math.abs(imageTranslateX) < 0.01 && Math.abs(imageTranslateY) < 0.01}
            >
              <Ionicons name="refresh" size={24} color={Math.abs(imageScale - 1) < 0.01 && Math.abs(imageTranslateX) < 0.01 && Math.abs(imageTranslateY) < 0.01 ? "#666" : "#FFFFFF"} />
            </TouchableOpacity>
          </View>
          
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            ref={(ref) => {
              fullScreenScrollRef.current = ref;
              if (ref && hasMultiplePages) {
                const pageWidth = Dimensions.get('window').width;
                ref.scrollTo({ x: fullScreenPageIndex * pageWidth, animated: false });
              }
            }}
            onScroll={(event) => {
              if (!hasMultiplePages) return;
              const offsetX = event.nativeEvent.contentOffset.x;
              const pageWidth = Dimensions.get('window').width;
              const pageIndex = Math.round(offsetX / pageWidth);
              if (pageIndex !== fullScreenPageIndex && pageIndex >= 0 && pageIndex < pages.length) {
                setFullScreenPageIndex(pageIndex);
              }
            }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.fullScreenPagesScrollContent}
          >
            {pages.map((pageUrl, index) => (
              <View key={index} style={styles.fullScreenPageContainer}>
                <GestureDetector
                  gesture={Gesture.Simultaneous(
                    Gesture.Pinch()
                      .onStart(() => {
                        imageLastScaleRef.current = 1.0;
                      })
                      .onUpdate((e) => {
                        const scaleChange = e.scale / imageLastScaleRef.current;
                        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, imageScaleRef.current * scaleChange));
                        imageLastScaleRef.current = e.scale;
                        imageScaleRef.current = newScale;
                        runOnJS(setImageScale)(newScale);
                        // Sync animated value for smooth gesture updates
                        imageScaleAnimated.setValue(newScale);
                      })
                      .onEnd(() => {
                        imageLastScaleRef.current = 1.0;
                      }),
                    Gesture.Pan()
                      .minPointers(1)
                      .maxPointers(2)
                      .onStart(() => {
                        imageLastPanXRef.current = imageTranslateXRef.current;
                        imageLastPanYRef.current = imageTranslateYRef.current;
                      })
                      .onUpdate((e) => {
                        const newX = imageLastPanXRef.current + e.translationX;
                        const newY = imageLastPanYRef.current + e.translationY;
                        imageTranslateXRef.current = newX;
                        imageTranslateYRef.current = newY;
                        runOnJS(setImageTranslateX)(newX);
                        runOnJS(setImageTranslateY)(newY);
                      })
                      .onEnd(() => {
                        // Keep the current translation values
                      })
                  )}
                >
                  <View style={styles.fullScreenImageContainer}>
            <Animated.Image
                      source={{ uri: pageUrl }}
              style={[
                styles.fullScreenImage,
                {
                  transform: [
                    { scale: imageScaleAnimated },
                    { translateX: imageTranslateX },
                    { translateY: imageTranslateY }
                  ]
                }
              ]}
              resizeMode="contain"
            />
                  </View>
                </GestureDetector>
              </View>
            ))}
          </ScrollView>

          {hasMultiplePages && (
            <View style={[styles.fullScreenPageControls, { paddingBottom: insets.bottom + 15 }]}>
              <TouchableOpacity
                style={[
                  styles.fullScreenPageButton,
                  fullScreenPageIndex === 0 && styles.fullScreenPageButtonDisabled
                ]}
                onPress={() => navigateFullScreenPage('prev')}
                disabled={fullScreenPageIndex === 0}
              >
                <Ionicons name="chevron-back" size={32} color={fullScreenPageIndex === 0 ? "#666" : "#FFFFFF"} />
              </TouchableOpacity>
              <Text style={styles.fullScreenPageIndicator}>
                {fullScreenPageIndex + 1} / {pages.length}
              </Text>
              <TouchableOpacity
                style={[
                  styles.fullScreenPageButton,
                  fullScreenPageIndex === pages.length - 1 && styles.fullScreenPageButtonDisabled
                ]}
                onPress={() => navigateFullScreenPage('next')}
                disabled={fullScreenPageIndex === pages.length - 1}
              >
                <Ionicons name="chevron-forward" size={32} color={fullScreenPageIndex === pages.length - 1 ? "#666" : "#FFFFFF"} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  const renderFullScreenLyrics = () => {
    if (!isLyricsFullscreen || !selectedSong) return null;

    return (
      <Modal
        visible={isLyricsFullscreen}
        transparent={false}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setIsLyricsFullscreen(false);
        }}
      >
        <GestureDetector
          gesture={Gesture.Simultaneous(
            Gesture.Pinch()
              .onStart(() => {
                lyricsLastScaleRef.current = 1.0;
              })
              .onUpdate((e) => {
                const scaleChange = e.scale / lyricsLastScaleRef.current;
                const newScale = Math.max(0.5, Math.min(5.0, lyricsZoomScaleRef.current * scaleChange));
                lyricsLastScaleRef.current = e.scale;
                lyricsZoomScaleRef.current = newScale;
                runOnJS(setLyricsZoomScale)(newScale);
              })
              .onEnd(() => {
                lyricsLastScaleRef.current = 1.0;
              }),
            Gesture.Pan()
              .minPointers(1)
              .maxPointers(2)
              .onStart(() => {
                lyricsLastPanXRef.current = lyricsTranslateXRef.current;
                lyricsLastPanYRef.current = lyricsTranslateYRef.current;
              })
              .onUpdate((e) => {
                const newX = lyricsLastPanXRef.current + e.translationX;
                const newY = lyricsLastPanYRef.current + e.translationY;
                lyricsTranslateXRef.current = newX;
                lyricsTranslateYRef.current = newY;
                runOnJS(setLyricsTranslateX)(newX);
                runOnJS(setLyricsTranslateY)(newY);
              })
              .onEnd(() => {
                // Keep the current translation values
              })
          )}
        >
          <View style={styles.fullScreenContainer}>
            <StatusBar hidden={true} />
            
            <View style={styles.fullScreenLyricsContainer}>
              <ScrollView
                style={styles.fullScreenLyricsScrollView}
                contentContainerStyle={styles.fullScreenLyricsScrollContent}
                showsHorizontalScrollIndicator={lyricsZoomScale > 1.0}
                showsVerticalScrollIndicator={lyricsZoomScale > 1.0}
                scrollEnabled={false}
                bounces={false}
              >
                <View
                  style={[
                    styles.fullScreenLyricsContent,
                    {
                      transform: [
                        { translateX: lyricsTranslateX },
                        { translateY: lyricsTranslateY },
                        { scale: lyricsZoomScale },
                      ],
                    },
                  ]}
                >
                  <Markdown style={markdownStyles}>
                    {selectedSong.lyrics || ''}
                  </Markdown>
                </View>
              </ScrollView>
            </View>
            
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => {
                setIsLyricsFullscreen(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </GestureDetector>
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
            
            <TouchableOpacity
              style={styles.createPlaylistButton}
              onPress={() => {
                setShowCreatePlaylistModal(true);
              }}
            >
              <Ionicons name="add-circle" size={24} color="#BB86FC" />
              <Text style={styles.createPlaylistButtonText}>Create New Playlist</Text>
            </TouchableOpacity>
            
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
                    Create a playlist to add songs
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreatePlaylistModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreatePlaylistModal(false);
          setNewPlaylist({ name: '', description: '', isPublic: false });
        }}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Playlist</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowCreatePlaylistModal(false);
                  setNewPlaylist({ name: '', description: '', isPublic: false });
                }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Create a new playlist and add "{selectedSong?.title}"
            </Text>
            
            <ScrollView style={styles.createPlaylistForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPlaylist.name}
                  onChangeText={(text) => setNewPlaylist({ ...newPlaylist, name: text })}
                  placeholder="Enter playlist name"
                  placeholderTextColor="#666666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={newPlaylist.description}
                  onChangeText={(text) => setNewPlaylist({ ...newPlaylist, description: text })}
                  placeholder="Enter playlist description (optional)"
                  placeholderTextColor="#666666"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setNewPlaylist({ ...newPlaylist, isPublic: !newPlaylist.isPublic })}
                >
                  <Ionicons
                    name={newPlaylist.isPublic ? "checkbox" : "square-outline"}
                    size={24}
                    color="#BB86FC"
                  />
                  <Text style={styles.checkboxLabel}>Make this playlist public</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.createButton, !newPlaylist.name.trim() && styles.createButtonDisabled]}
                onPress={handleCreatePlaylistAndAddSong}
                disabled={!newPlaylist.name.trim()}
              >
                <Text style={styles.createButtonText}>Create Playlist & Add Song</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

  // Filtered songs navigation functions
  const handlePreviousFilteredSong = async () => {
    if (filteredSongs.length > 0 && currentFilteredIndex >= 0) {
      try {
        const newIndex = currentFilteredIndex > 0 ? currentFilteredIndex - 1 : filteredSongs.length - 1;
        const previousSong = filteredSongs[newIndex];
        
        if (previousSong) {
          setCurrentFilteredIndex(newIndex);
          setSelectedSong(previousSong);
          setIsFinished(false);
          // Stop current playback and progress tracking
          setIsPlaying(false);
          // Reset initialization state for new song
          setIsInitialized(false);
          // Small delay to ensure proper cleanup before loading new song
          setTimeout(() => {
            handleSongSelect(previousSong);
          }, 100);
        }
      } catch (error) {
        console.error('Error going to previous filtered song:', error);
        Alert.alert('Error', 'Failed to go to previous song');
      }
    }
  };

  const handleNextFilteredSong = async () => {
    if (filteredSongs.length > 0 && currentFilteredIndex >= 0) {
      try {
        let newIndex = currentFilteredIndex < filteredSongs.length - 1 ? currentFilteredIndex + 1 : 0;
        
        // If repeating is enabled and we're at the end, restart from beginning
        if (newIndex === 0 && currentFilteredIndex === filteredSongs.length - 1 && !isFilteredRepeating) {
          // Don't loop if repeat is not enabled
          return;
        }
        
        const nextSong = filteredSongs[newIndex];
        
        if (nextSong) {
          setCurrentFilteredIndex(newIndex);
          setSelectedSong(nextSong);
          setIsFinished(false);
          // Stop current playback and progress tracking
          setIsPlaying(false);
          // Reset initialization state for new song
          setIsInitialized(false);
          // Small delay to ensure proper cleanup before loading new song
          setTimeout(() => {
            handleSongSelect(nextSong);
          }, 100);
        }
      } catch (error) {
        console.error('Error going to next filtered song:', error);
        Alert.alert('Error', 'Failed to go to next song');
      }
    }
  };

  const handleJumpToFilteredSong = async (songIndex: number) => {
    if (filteredSongs.length === 0 || songIndex < 0 || songIndex >= filteredSongs.length) {
      return;
    }

    try {
      const targetSong = filteredSongs[songIndex];
      console.log('Jumping to filtered song:', targetSong.title, 'at index:', songIndex);
      
      // Stop current playback
      await stopLocalPlayback();
      
      // Update filtered index
      setCurrentFilteredIndex(songIndex);
      setSelectedSong(targetSong);
      setIsFinished(false);
      setIsPlaying(false);
      setIsInitialized(false);
      
      // Close modal
      setShowFilteredSongsModal(false);
      
      // Small delay to ensure proper cleanup before loading new song
      setTimeout(() => {
        handleSongSelect(targetSong);
      }, 100);
    } catch (error) {
      console.error('Error jumping to filtered song:', error);
      Alert.alert('Error', 'Failed to jump to song');
    }
  };

  const handleRestartFilteredSong = async () => {
    if (filteredSongs.length === 0 || currentFilteredIndex < 0) {
      Alert.alert('Info', 'No song to restart.');
      return;
    }

    console.log('Restarting filtered song');
    try {
      // Stop current playback first
      await stopLocalPlayback();
      
      // Reset to first song in filtered list
      const firstSong = filteredSongs[0];
      setCurrentFilteredIndex(0);
      setSelectedSong(firstSong);
      setIsFinished(false);
      setIsPlaying(false);
      setIsInitialized(false);
      
      // Small delay to ensure proper cleanup before loading new song
      setTimeout(() => {
        handleSongSelect(firstSong);
      }, 100);
    } catch (error) {
      console.error('Error restarting filtered song:', error);
      Alert.alert('Error', 'Failed to restart song');
    }
  };

  const handleToggleFilteredRepeat = () => {
    setIsFilteredRepeating(!isFilteredRepeating);
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
      setCurrentFilteredIndex(-1);
      setShowPlaylistControls(true);
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

  const handleCreatePlaylistAndAddSong = async () => {
    if (!user || !selectedSong || !newPlaylist.name.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    try {
      // Create the playlist
      const createdPlaylist = await playlistService.createPlaylist(user.id, newPlaylist);
      
      // Add the song to the newly created playlist
      await playlistService.addSongToPlaylist(createdPlaylist.id, {
        songId: selectedSong.id
      }, selectedSong as any);
      
      // Reset form and close modals
      setNewPlaylist({ name: '', description: '', isPublic: false });
      setShowCreatePlaylistModal(false);
      setShowAddToPlaylistModal(false);
      
      // Reload playlists to show the new one
      await loadUserPlaylists();
      
      Alert.alert('Success', `Playlist "${createdPlaylist.name}" created and song added!`);
    } catch (error) {
      console.error('Error creating playlist and adding song:', error);
      Alert.alert('Error', 'Failed to create playlist and add song');
    }
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
                rightComponent={
                  <TouchableOpacity 
                    onPress={() => setShowPlaylistControls(!showPlaylistControls)}
                    style={{ padding: 8 }}
                  >
                    <Ionicons 
                      name={showPlaylistControls ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color="#BB86FC" 
                    />
                  </TouchableOpacity>
                }
              />
            ) : (
              <View style={[styles.header, isLandscape && styles.headerLandscape]}>
                <View style={[styles.headerTop, isLandscape && styles.headerTopLandscape]}>
                  <View style={styles.headerLeftContainer}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => {
                        setSelectedSong(null);
                        setCurrentFilteredIndex(-1);
                        setShowNavigationControls(true);
                        setIsFilteredRepeating(false);
                      }}
                    >
                      <Ionicons name="chevron-back" size={24} color="#BB86FC" />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.songHeaderText}>
                    <MarqueeText 
                      text={selectedSong.title} 
                      style={[styles.title, { textAlign: 'center' }]}
                    />
                    <RightToLeftMarqueeText 
                      text={selectedSong.artist}
                      style={[styles.artist, { textAlign: 'center' }]}
                    />
                    {selectedSong.album && (
                      <RightToLeftMarqueeText 
                        text={selectedSong.album}
                        style={[styles.album, { textAlign: 'center' }]}
                      />
                    )}
                  </View>
                  
                  <View style={styles.headerRightContainer}>
                    {hasAdminAccess && (
                      <>
                        {isAdminMode ? (
                          <TouchableOpacity 
                            style={[styles.iconButton, { marginRight: 8 }]}
                            onPress={() => {
                              setIsAdminMode(false);
                              onAdminModeChange?.(false);
                            }}
                          >
                            <Ionicons name="lock-open-outline" size={24} color="#BB86FC" />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.iconButton, { marginRight: 8 }]}
                            onPress={() => {
                              setPendingSongOperation('admin');
                              setShowSongPasswordDialog(true);
                              setSongPassword('');
                              setSongPasswordError('');
                            }}
                          >
                            <Ionicons name="lock-closed-outline" size={24} color="#BB86FC" />
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                    {filteredSongs.length > 0 && currentFilteredIndex >= 0 && (
                      <TouchableOpacity 
                        style={styles.iconButton}
                        onPress={() => setShowNavigationControls(!showNavigationControls)}
                      >
                        <Ionicons 
                          name={showNavigationControls ? "chevron-up" : "chevron-down"} 
                          size={24} 
                          color="#BB86FC" 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
            
            {/* Filtered songs navigation controls section */}
            {!isPlaylistMode && selectedSong && filteredSongs.length > 0 && currentFilteredIndex >= 0 && showNavigationControls && (
              <View style={styles.playlistControlsSection}>
                <TouchableOpacity 
                  style={styles.playlistTrackInfo}
                  onPress={handleRestartFilteredSong}
                >
                  <Text style={styles.playlistTrackCount}>
                    {currentFilteredIndex + 1} of {filteredSongs.length}
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.playlistControls}>
                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistListBtn]}
                    onPress={() => setShowFilteredSongsModal(true)}
                  >
                    <Ionicons name="list" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistPrevBtn]}
                    onPress={handlePreviousFilteredSong}
                  >
                    <Ionicons name="play-skip-back" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistPauseBtn]}
                    onPress={togglePlayback}
                  >
                    <Ionicons 
                      name={isPlaying ? 'pause' : 'play'} 
                      size={18} 
                      color="#FFFFFF" 
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistNextBtn]}
                    onPress={handleNextFilteredSong}
                  >
                    <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.playlistControlBtn, styles.playlistRestartBtn, isFilteredRepeating && styles.playlistRepeatActive]}
                    onPress={handleToggleFilteredRepeat}
                  >
                    <Ionicons name="repeat" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Playlist controls section */}
             {isPlaylistMode && currentPlaylist && showPlaylistControls && (
               <View style={styles.playlistControlsSection}>
                 <View style={styles.playlistTrackInfo}>
                   <Text style={styles.playlistTrackCount}>
                     {currentPlaylistIndex + 1} of {playlistSongs.length}
                   </Text>
                   <MarqueeText 
                     text={selectedSong.title} 
                     style={styles.playlistSongTitle}
                   />
                   <Text style={styles.playlistSongArtist} numberOfLines={1} ellipsizeMode="tail">
                     {selectedSong.album ? `${selectedSong.artist} - ${selectedSong.album}` : selectedSong.artist}
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
            {onNavigateToAIAssistant && hasAIAssistantAccess && (
              <TouchableOpacity
                style={styles.bottomNavButton}
                onPress={onNavigateToAIAssistant}
              >
                <Ionicons 
                  name="sparkles" 
                  size={24} 
                  color="#BB86FC" 
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.bottomNavButton, showFavoritesOnly && styles.activeFilterButton]}
              onPress={toggleFavoritesFilter}
            >
              <Ionicons 
                name="heart" 
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
      {/* Group Management Modal */}
      <Modal
        visible={showGroupManagement}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <GroupManagement 
          onClose={() => setShowGroupManagement(false)} 
          currentUserId={user?.id}
        />
      </Modal>

      {/* Song Access Management Modal */}
      <Modal
        visible={showSongAccessManagement}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SongAccessManagement 
          onClose={() => setShowSongAccessManagement(false)} 
          songs={songs}
          currentUserId={user?.id}
          favoriteSongs={favoriteSongs}
          onSongUpdate={(songId, updates) => {
            setSongs(prevSongs => 
              prevSongs.map(song => 
                song.id === songId ? { ...song, ...updates } : song
              )
            );
          }}
        />
      </Modal>
      {renderFullScreenImage()}
      {renderFullScreenLyrics()}
      
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
              keyExtractor={(item, index) => `playlist-song-${item.id}-${index}`}
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
                      <Text style={styles.playlistSongArtist} numberOfLines={1} ellipsizeMode="tail">
                        {item.album ? `${item.artist} - ${item.album}` : item.artist}
                      </Text>
                    </View>
                  </View>
                  {index === currentPlaylistIndex && (
                    <Ionicons name="play" size={20} color="#BB86FC" />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Filtered Songs Modal */}
      <Modal
        visible={showFilteredSongsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.playlistModalContainer}>
          <View style={styles.playlistModalHeader}>
            <TouchableOpacity onPress={() => setShowFilteredSongsModal(false)}>
              <Text style={styles.playlistModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.playlistModalTitle}>Filtered Songs</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <View style={styles.playlistModalContent}>
            <FlatList
              data={filteredSongs}
              keyExtractor={(item, index) => `filtered-song-${item.id}-${index}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[
                    styles.playlistSongItem,
                    index === currentFilteredIndex && styles.playlistSongItemActive
                  ]}
                  onPress={() => handleJumpToFilteredSong(index)}
                >
                  <View style={styles.playlistSongInfo}>
                    <Text style={[
                      styles.playlistSongNumber,
                      index === currentFilteredIndex && styles.playlistSongNumberActive
                    ]}>
                      {index + 1}
                    </Text>
                    <View style={styles.playlistSongDetails}>
                      <Text style={[
                        styles.playlistSongTitle,
                        index === currentFilteredIndex && styles.playlistSongTitleActive
                      ]}>
                        {item.title}
                      </Text>
                      <Text style={styles.playlistSongArtist} numberOfLines={1} ellipsizeMode="tail">
                        {item.album ? `${item.artist} - ${item.album}` : item.artist}
                      </Text>
                    </View>
                  </View>
                  {index === currentFilteredIndex && (
                    <Ionicons name="play" size={20} color="#BB86FC" />
                  )}
                </TouchableOpacity>
              )}
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
  headerLeftContainer: {
    width: 80,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerRightContainer: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songHeaderText: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  album: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
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
    // Position handled by parent container
  },
  toggleButton: {
    padding: 4,
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
  adminButtonsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  addSongButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 80,
  },
  addSongButtonText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  groupManagementButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 80,
  },
  groupManagementButtonText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  songAccessButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 80,
  },
  songAccessButtonText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 14,
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
  trackUploadContainerActive: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    padding: 4,
    marginRight: 4,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2C',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: '600',
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
  lyricsScrollView: {
    flex: 1,
  },
  lyricsScrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  lyricsContent: {
    width: '100%',
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
  scoreItemContainer: {
    marginBottom: 8,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  pageCountText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 8,
  },
  addPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
    gap: 6,
  },
  addPageButtonText: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: '500',
  },
  pagesListContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
  },
  pageItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 4,
    backgroundColor: '#121212',
    borderRadius: 4,
  },
  pageItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  removePageButton: {
    padding: 4,
    borderRadius: 4,
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
  resourceDragHandleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  filterSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterSectionBox: {
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    overflow: 'hidden',
  },
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252525',
  },
  filterSectionTitle: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  filterSectionContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  filterSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  filterSearchIcon: {
    marginRight: 8,
  },
  filterSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 4,
  },
  filterSearchClearButton: {
    marginLeft: 8,
    padding: 4,
  },
  clearSectionButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  clearSectionButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyFilterText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  fullScreenZoomControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    flexDirection: 'column',
  },
  fullScreenZoomButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullScreenZoomButtonDisabled: {
    backgroundColor: 'rgba(102, 102, 102, 0.3)',
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
  fullScreenPageControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    paddingBottom: 40, // Extra padding for safe area and device home indicators
  },
  fullScreenPageButton: {
    backgroundColor: 'rgba(187, 134, 252, 0.3)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPageButtonDisabled: {
    backgroundColor: 'rgba(102, 102, 102, 0.3)',
  },
  fullScreenPageIndicator: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  fullScreenPagesScrollContent: {
    flexDirection: 'row',
  },
  fullScreenPageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePagesContainer: {
    width: '100%',
  },
  scorePageControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 8,
  },
  scorePageButton: {
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePageButtonDisabled: {
    backgroundColor: '#1A1A1A',
    opacity: 0.5,
  },
  scorePageIndicator: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  scorePagesScrollContent: {
    flexDirection: 'row',
  },
  scorePageItem: {
    width: Dimensions.get('window').width - 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenLyricsContainer: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  fullScreenLyricsScrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullScreenLyricsScrollContent: {
    flexGrow: 1,
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: Dimensions.get('window').width,
    minHeight: Dimensions.get('window').height,
  },
  fullScreenLyricsContent: {
    width: Dimensions.get('window').width - 80,
  },
  lyricsHeaderLeft: {
    flex: 1,
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
  createPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BB86FC',
    borderStyle: 'dashed',
  },
  createPlaylistButtonText: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  createPlaylistForm: {
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3C3C3C',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 8,
  },
  createButton: {
    backgroundColor: '#BB86FC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#3C3C3C',
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  playlistSongTitleActive: {
    color: '#BB86FC',
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
    borderRadius: 0,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(187, 134, 252, 0.2)',
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

const markdownStyles = {
  body: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  heading2: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  heading3: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  heading4: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 6,
    marginBottom: 4,
  },
  heading5: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 4,
    marginBottom: 2,
  },
  heading6: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 4,
    marginBottom: 2,
  },
  strong: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  em: {
    color: '#FFFFFF',
    fontStyle: 'italic' as const,
  },
  link: {
    color: '#BB86FC',
    textDecorationLine: 'underline' as const,
  },
  blockquote: {
    backgroundColor: 'rgba(187, 134, 252, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#BB86FC',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    color: '#FFFFFF',
  },
  code_inline: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#BB86FC',
    fontSize: 13,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  code_block: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#BB86FC',
    fontSize: 13,
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  list_item: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  hr: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    height: 1,
    marginVertical: 12,
  },
};