import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, FlatList, TextInput, Animated, Easing, Alert, Clipboard, ActivityIndicator, Image, Linking, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { database } from '../config/firebase';
import AudioStorageService from '../services/audioStorage';
import * as DocumentPicker from 'expo-document-picker';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';

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

interface Song {
  id: string;
  title: string;
  artist: string;
  tracks: Track[];
  lyrics?: string;  // Optional lyrics field
  scores?: Score[];  // Array of scores instead of single score
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

const HomePage = () => {
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
  const [isSessionMenuExpanded, setIsSessionMenuExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [expandedScores, setExpandedScores] = useState<{ [key: string]: boolean }>({});
  const [isFinished, setIsFinished] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Add playback speed state
  
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
    scores: []
  });
  const [showEditSongDialog, setShowEditSongDialog] = useState(false);
  const [editingSong, setEditingSong] = useState<EditSongForm | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [songToDelete, setSongToDelete] = useState<Song | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [password, setPassword] = useState('');
  const ADMIN_PASSWORD = 'admin123'; // You should change this to a more secure password
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'tracks' | 'lyrics' | 'sheetMusic' | 'score'>('tracks');
  const [isLyricsEditing, setIsLyricsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState('');

  // Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [showRecordingControls, setShowRecordingControls] = useState(false);
  const [recordingName, setRecordingName] = useState('Voice Recording');

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
    if (Math.abs(syncState.seekPosition - seekPosition) > 0.1) {
      handleSeek(selectedSong.tracks[0].id, syncState.seekPosition);
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
        if (activeTrackIds.includes(selectedSong.tracks[index].id)) {
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
            
            if (activeTrackIds.includes(selectedSong.tracks[i].id)) {
              hasActiveTracks = true;
              setTrackProgress(prev => ({
                ...prev,
                [selectedSong.tracks[i].id]: position
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
          }
        }
      }
    }, 50);

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized, selectedSong, isFinished, activeTrackIds, isRepeat]);

  // Optimize handleSeek function
  const handleSeek = async (trackId: string, value: number) => {
    if (!isInitialized || !selectedSong) return;

    setIsSeeking(true);
    setSeekPosition(value);
    
    try {
      // Use Promise.all for parallel seeking
      await Promise.all(
        players.map(async (player) => {
          const status = await player.getStatusAsync();
          if (status.isLoaded) {
            await player.setPositionAsync(value * 1000);
          }
        })
      );

      setTrackProgress(prev => {
        const newProgress = { ...prev };
        selectedSong.tracks.forEach(track => {
          newProgress[track.id] = value;
        });
        return newProgress;
      });
    } catch (error) {
      console.error('Error seeking:', error);
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
        const initialLoadingState = selectedSong.tracks.reduce((acc, track) => ({
          ...acc,
          [track.id]: true
        }), {});
        setLoadingTracks(initialLoadingState);

        // Unload previous players
        await Promise.all(players.map(player => player.unloadAsync()));

        const audioStorage = AudioStorageService.getInstance();
        const loadedPlayers = await Promise.all(
          selectedSong.tracks.map(async (track) => {
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

        // Initialize volumes
        const initialVolumes = selectedSong.tracks.reduce((acc, track) => ({
          ...acc,
          [track.id]: 1
        }), {});
        setTrackVolumes(initialVolumes);

        // Get durations
        loadedPlayers.forEach(async (player, index) => {
          const status = await player.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setTrackDurations(prev => ({
              ...prev,
              [selectedSong.tracks[index].id]: status.durationMillis! / 1000
            }));
          }
        });

        // Set all tracks as active initially
        setActiveTrackIds(selectedSong.tracks.map(track => track.id));
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

  const handleSongSelect = (song: Song) => {
    setIsPlaying(false);
    setSelectedSong(song);
  };

  const filteredSongs = useMemo(() => {
    console.log('Current songs state:', songs);
    if (!searchQuery.trim()) return songs;
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = songs.filter(song => 
      song.title.toLowerCase().includes(query) || 
      song.artist.toLowerCase().includes(query)
    );
    console.log('Filtered songs:', filtered);
    return filtered;
  }, [searchQuery, songs]);

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={[
        styles.songItem,
        selectedSong?.id === item.id && styles.selectedSongItem
      ]}
      onPress={() => handleSongSelect(item)}
    >
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
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
        <Ionicons 
          name="chevron-forward" 
          size={24} 
          color="#BBBBBB" 
        />
      </View>
    </TouchableOpacity>
  );

  const renderJoinDialog = () => (
    <View style={styles.dialogOverlay}>
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
    </View>
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

    const trackIndex = selectedSong.tracks.findIndex(t => t.id === trackId);
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

    selectedSong.tracks.forEach(async (track, index) => {
      const isActive = activeTrackIds.includes(track.id);
      if (newSoloedTrackIds.length === 0) {
        await players[index].setVolumeAsync(isActive ? (trackVolumes[track.id] || 1) : 0);
      } else {
        await players[index].setVolumeAsync(
          newSoloedTrackIds.includes(track.id) ? (trackVolumes[track.id] || 1) : 0
        );
      }
    });
  };

  const handleVolumeChange = async (trackId: string, value: number) => {
    if (!isInitialized || !selectedSong) return;

    const trackIndex = selectedSong.tracks.findIndex(t => t.id === trackId);
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
  };

  const toggleTrack = async (trackId: string) => {
    if (!isInitialized || !selectedSong) return;

    const trackIndex = selectedSong.tracks.findIndex(t => t.id === trackId);
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
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Select a Song</Text>
        <View style={styles.titleButtons}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (isAdminMode) {
                setIsAdminMode(false);
              } else {
                setShowPasswordDialog(true);
              }
            }}
          >
            <Ionicons 
              name="create-outline" 
              size={24} 
              color={isAdminMode ? "#03DAC6" : "#BB86FC"} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setIsSessionMenuExpanded(!isSessionMenuExpanded)}
          >
            <Ionicons 
              name="people" 
              size={24} 
              color="#BB86FC" 
            />
          </TouchableOpacity>
        </View>
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
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#BBBBBB" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs..."
          placeholderTextColor="#666666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#BBBBBB" />
          </TouchableOpacity>
        ) : null}
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
      />
    </View>
  );

  // Add function to start editing a song
  const startEditingSong = (song: Song) => {
    setEditingSong({
      id: song.id,
      title: song.title,
      artist: song.artist,
      tracks: song.tracks.map(track => ({
        ...track,
        file: null
      })),
      lyrics: song.lyrics,
      scores: song.scores || []
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

      if (editingSong.tracks.length === 0) {
        throw new Error('Please add at least one track');
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
        scores: editingSong.scores || []
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
      <View style={styles.dialogOverlay}>
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
            
            <View style={styles.tracksHeader}>
              <Text style={styles.tracksTitle}>Tracks</Text>
              <TouchableOpacity
                style={styles.addTrackButton}
                onPress={addNewTrackToSong}
              >
                <Ionicons name="add-circle" size={24} color="#BB86FC" />
                <Text style={styles.addTrackButtonText}>Add Track</Text>
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
                  <Text style={styles.fileName} numberOfLines={1}>
                    {track.file.name}
                  </Text>
                ) : (
                  <Text style={styles.fileName} numberOfLines={1}>
                    Current: {track.path.split('/').pop()}
                  </Text>
                )}
              </View>
            ))}
            
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
      </View>
    );
  };

  // Add function to handle song deletion
  const handleDeleteSong = async () => {
    if (!songToDelete) return;

    try {
      // Delete all audio files from Firebase Storage
      await Promise.all(
        songToDelete.tracks.map(async (track) => {
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
      setPassword('');
    } else {
      Alert.alert('Error', 'Incorrect password');
      setPassword('');
    }
  };

  // Add render function for password dialog
  const renderPasswordDialog = () => (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Enter Password</Text>
        <TextInput
          style={styles.dialogInput}
          placeholder="Password"
          placeholderTextColor="#666666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
    </View>
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

      if (newSong.tracks.length === 0) {
        throw new Error('Please add at least one track');
      }

      // Generate a new ID
      const newId = generateId();
      
      // Create folder name from title
      const folderName = newSong.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      // Upload files and create tracks
      const tracks = await Promise.all(
        newSong.tracks.map(async (track, index) => {
          if (!track.file) {
            throw new Error(`Please upload file for track "${track.name || `Track ${index + 1}`}"`);
          }
          
          if (!track.name.trim()) {
            throw new Error(`Please enter a name for track ${index + 1}`);
          }
          
          // Upload file to Firebase Storage
          const filePath = `audio/${folderName}/${newSong.title} - ${track.name}.mp3`;
          await AudioStorageService.getInstance().uploadAudioFile(track.file, filePath);
          
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
        scores: newSong.scores
      };

      // Add to Firebase
      const songRef = ref(database, `songs/${newId}`);
      await set(songRef, {
        title: songToAdd.title,
        artist: songToAdd.artist,
        tracks: songToAdd.tracks,
        lyrics: songToAdd.lyrics,
        scores: songToAdd.scores
      });

      // Reset form and close dialog
      setNewSong({
        title: '',
        artist: '',
        tracks: [],
        lyrics: '',
        scores: []
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

  // Modify renderAddSongDialog to use the new multiple track selection
  const renderAddSongDialog = () => (
    <View style={styles.dialogOverlay}>
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
                  onPress={() => removeTrack(track.id)}
                >
                  <Ionicons name="trash-outline" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>
              {track.file && (
                <View style={styles.fileNameContainer}>
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {track.file.name}
                  </Text>
                </View>
              )}
            </View>
          ))}
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
    </View>
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
        </View>
        <View style={{ flex: 1 }}>
          <ScrollView style={styles.contentScrollView}>
            {activeView === 'tracks' ? (
              // Tracks view content
              <View>
                {selectedSong.tracks.map(track => (
                  <View key={track.id} style={styles.trackContainer}>
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
                  </View>
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
            ) : (
              // Scores view content
              <View style={styles.sheetMusicContainer}>
                {selectedSong.scores?.map((score, index) => (
                  <View key={score.id} style={styles.scoreView}>
                    <View style={styles.scoreHeader}>
                      <Text style={styles.scoreTitle}>{score.name}</Text>
                      <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => toggleScoreExpansion(score.id)}
                      >
                        <Ionicons
                          name={expandedScores[score.id] ? "chevron-up" : "chevron-down"}
                          size={24}
                          color="#BB86FC"
                        />
                      </TouchableOpacity>
                    </View>
                    {expandedScores[score.id] && (
                      score.url.endsWith('.pdf') ? (
                        <View style={styles.sheetMusicView}>
                          <WebView
                            source={{ 
                              uri: `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(score.url)}`
                            }}
                            style={{
                              flex: 1,
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
                        <Image
                          source={{ uri: score.url }}
                          style={styles.sheetMusicImage}
                          resizeMode="contain"
                        />
                      )
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
    if (!isInitialized || !selectedSong) return;
    
    const newPosition = Math.min(
      (trackProgress[selectedSong.tracks[0]?.id] || 0) + 10,
      trackDurations[selectedSong.tracks[0]?.id] || 0
    );
    
    await handleSeek(selectedSong.tracks[0].id, newPosition);
    
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
    if (!isInitialized || !selectedSong) return;
    
    const newPosition = Math.max(
      (trackProgress[selectedSong.tracks[0]?.id] || 0) - 10,
      0
    );
    
    await handleSeek(selectedSong.tracks[0].id, newPosition);
    
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
        if (activeTrackIds.includes(selectedSong.tracks[index].id)) {
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
        tracks: [...selectedSong.tracks, newTrack]
      });

      // Reset recording state
      setRecordedUri(null);
      setShowRecordingControls(false);
      setRecordingName('Voice Recording');

      // Reload the song to include the new track
      const updatedSong = { ...selectedSong, tracks: [...selectedSong.tracks, newTrack] };
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
          onPress={() => {
            // Placeholder for future functionality
            console.log('Placeholder button pressed');
          }}
        >
          <Ionicons 
            name="ellipsis-horizontal-circle" 
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
            size={40} 
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
      </View>
      {renderRecordingControls()}
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

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="light" />
      <SafeAreaView style={styles.content}>
        {!selectedSong ? renderSongList() : (
          // Track Player View
          <>
            <View style={styles.header}>
              <View style={styles.headerTop}>
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
              <View style={styles.playbackControlsContainer}>
                {renderPlaybackControls()}
              </View>
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
                    await handleSeek(selectedSong.tracks[0].id, value);
                    
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
            </View>
            
            <View style={styles.mainContent}>
              {renderSongView()}
            </View>
          </>
        )}
      </SafeAreaView>
      {showJoinDialog && renderJoinDialog()}
      {showSessionIdDialog && renderSessionIdDialog()}
      {showSessionsList && renderSessionsList()}
      {showAddSongDialog && renderAddSongDialog()}
      {showEditSongDialog && renderEditSongDialog()}
      {showDeleteConfirmDialog && renderDeleteConfirmDialog()}
      {showPasswordDialog && renderPasswordDialog()}
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
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
  },
  selectedSongItem: {
    backgroundColor: '#2C2C2C',
  },
  songInfo: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 16,
    marginBottom: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
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
    backgroundColor: '#1B4332',
  },
  dialogButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#121212',
    height: '100%',
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
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: '#1B4332',
  },
  soloActiveText: {
    color: '#4CAF50',
  },
  muteActiveButton: {
    backgroundColor: '#3D0C11',
  },
  muteActiveText: {
    color: '#FF5252',
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
    backgroundColor: '#1B4332',
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
    marginTop: 8,
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
    backgroundColor: '#1B4332',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sessionMenuButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionMenuButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  adminButton: {
    backgroundColor: '#1B4332',
  },
  clientButton: {
    backgroundColor: '#2C2C2C',
  },
  sessionMenuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  sessionMenuButtonSubtext: {
    color: '#BBBBBB',
    fontSize: 12,
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
  removeTrackButton: {
    padding: 4,
  },
  trackUploadLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
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
    backgroundColor: '#1B4332',
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
    backgroundColor: '#03DAC6',
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
    padding: 12,
    flex: 1,
    minHeight: 600,
  },
  sheetMusicView: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    minHeight: 600,
  },
  sheetMusicImage: {
    width: '100%',
    height: 800,
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
    backgroundColor: '#1B4332',
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
    marginBottom: 24,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  expandButton: {
    padding: 4,
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
  controlButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButton: {
    width: 36,
    height: 36,
  },
  playButton: {
    width: 48,
    height: 48,
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
  saveButton: {
    backgroundColor: '#1F1F1F',
  },
  cancelButton: {
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
});