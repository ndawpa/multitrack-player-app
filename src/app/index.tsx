import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, FlatList, TextInput, Animated, Easing, Alert, Clipboard, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { database } from '../config/firebase';
import AudioStorageService from '../services/audioStorage';
import * as DocumentPicker from 'expo-document-picker';

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

interface Song {
  id: string;
  title: string;
  artist: string;
  tracks: Track[];
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
}

const songs: Song[] = [
  {
    id: '1',
    title: 'Chegou a Hora',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '1-1',
        name: '1 Tenor',
        path: 'audio/chegou_a_hora/Chegou a Hora - 1 Tenor.mp3'
      },
      {
        id: '1-2',
        name: '2 Tenor',
        path: 'audio/chegou_a_hora/Chegou a Hora - 2 Tenor.mp3'
      },
      {
        id: '1-3',
        name: 'Barítono',
        path: 'audio/chegou_a_hora/Chegou a Hora - Barítono.mp3'
      },
      {
        id: '1-4',
        name: 'Baixo',
        path: 'audio/chegou_a_hora/Chegou a Hora - Baixo.mp3'
      },
      {
        id: '1-5',
        name: 'Original',
        path: 'audio/chegou_a_hora/Chegou a Hora - Original.mp3'
      },
      {
        id: '1-6',
        name: 'Playback',
        path: 'audio/chegou_a_hora/Chegou a Hora - Playback.mp3'
      }
    ]
  },
  {
    id: '2',
    title: 'Jesus de Nazaré',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '2-1',
        name: '1 Tenor',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - 1 Tenor.mp3'
      },
      {
        id: '2-2',
        name: '2 Tenor',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - 2 Tenor.mp3'
      },
      {
        id: '2-3',
        name: 'Barítono',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Barítono.mp3'
      },
      {
        id: '2-4',
        name: 'Baixo',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Baixo.mp3'
      },
      {
        id: '2-5',
        name: 'Original',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Cantado.mp3'
      },
      {
        id: '2-6',
        name: 'Playback',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Playback.mp3'
      }
    ]
  },
  {
    id: '3',
    title: 'Se Ele Não For o Primeiro',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '3-1',
        name: '1 Tenor',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - 1 Tenor.mp3'
      },
      {
        id: '3-2',
        name: '2 Tenor',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - 2 Tenor.mp3'
      },
      {
        id: '3-3',
        name: 'Barítono',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Barítono.mp3'
      },
      {
        id: '3-4',
        name: 'Baixo',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Baixo.mp3'
      },
      {
        id: '3-5',
        name: 'Original',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Cantado.mp3'
      },
      {
        id: '3-6',
        name: 'Playback',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Playback.mp3'
      }
    ]
  },
  {
    id: '4',
    title: 'Eu Quero Amá-Lo Mais',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '4-1',
        name: '1 Tenor',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - 1 Tenor.mp3'
      },
      {
        id: '4-2',
        name: '2 Tenor',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - 2 Tenor.mp3'
      },
      {
        id: '4-3',
        name: 'Barítono',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Barítono.mp3'
      },
      {
        id: '4-4',
        name: 'Baixo',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Baixo.mp3'
      },
      {
        id: '4-5',
        name: 'Original',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-lo Mais - Cantado.mp3'
      },
      {
        id: '4-6',
        name: 'Playback',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Playback.mp3'
      }
    ]
  },
  {
    id: '5',
    title: 'O Nome Cristo',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '5-1',
        name: '1 Tenor',
        path: 'audio/o_nome_cristo/O Nome Cristo - 1 Tenor.mp3'
      },
      {
        id: '5-2',
        name: '2 Tenor',
        path: 'audio/o_nome_cristo/O Nome Cristo - 2 Tenor.mp3'
      },
      {
        id: '5-3',
        name: 'Barítono',
        path: 'audio/o_nome_cristo/O Nome Cristo - Barítono.mp3'
      },
      {
        id: '5-4',
        name: 'Baixo',
        path: 'audio/o_nome_cristo/O Nome Cristo - Baixo.mp3'
      },
      {
        id: '5-5',
        name: 'Original',
        path: 'audio/o_nome_cristo/O Nome Cristo - Cantado.mp3'
      },
      {
        id: '5-6',
        name: 'Playback',
        path: 'audio/o_nome_cristo/O Nome Cristo - Playback.mp3'
      }
    ]
  },
  {
    id: '6',
    title: 'Começando Aqui',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '6-1',
        name: '1 Tenor',
        path: 'audio/comecando_aqui/Começando Aqui - 1 Tenor.mp3'
      },
      {
        id: '6-2',
        name: '2 Tenor',
        path: 'audio/comecando_aqui/Começando Aqui - 2 Tenor.mp3'
      },
      {
        id: '6-3',
        name: 'Barítono',
        path: 'audio/comecando_aqui/Começando Aqui - Barítono.mp3'
      },
      {
        id: '6-4',
        name: 'Baixo',
        path: 'audio/comecando_aqui/Começando Aqui - Baixo.mp3'
      },
      {
        id: '6-5',
        name: 'Original',
        path: 'audio/comecando_aqui/Começando Aqui - Cantado.mp3'
      },
      {
        id: '6-6',
        name: 'Playback',
        path: 'audio/comecando_aqui/Começando Aqui - Playback.mp3'
      }
    ]
  },
  {
    id: '7',
    title: 'Vaso de Alabastro',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '7-1',
        name: '1 Tenor',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - 1 Tenor.mp3'
      },
      {
        id: '7-2',
        name: '2 Tenor',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - 2 Tenor.mp3'
      },
      {
        id: '7-3',
        name: 'Barítono',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Barítono.mp3'
      },
      {
        id: '7-4',
        name: 'Baixo',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Baixo.mp3'
      },
      {
        id: '7-5',
        name: 'Original',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Cantado.mp3'
      },
      {
        id: '7-6',
        name: 'Playback',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Playback.mp3'
      }
    ]
  },
  {
    id: '8',
    title: 'Vem a Mim',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '8-1',
        name: '1 Tenor',
        path: 'audio/vem_a_mim/Vem a Mim - 1 Tenor.mp3'
      },
      {
        id: '8-2',
        name: '2 Tenor',
        path: 'audio/vem_a_mim/Vem a Mim - 2 Tenor.mp3'
      },
      {
        id: '8-3',
        name: 'Barítono',
        path: 'audio/vem_a_mim/Vem a Mim - Barítono.mp3'
      },
      {
        id: '8-4',
        name: 'Baixo',
        path: 'audio/vem_a_mim/Vem a Mim - Baixo.mp3'
      },
      {
        id: '8-5',
        name: 'Original',
        path: 'audio/vem_a_mim/Vem a Mim - Cantado.mp3'
      },
      {
        id: '8-6',
        name: 'Playback',
        path: 'audio/vem_a_mim/Vem a Mim - Playback.mp3'
      }
    ]
  },
  {
    id: '9',
    title: 'Eu Sei de Um Rio',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '9-1',
        name: '1 Tenor',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - 1 Tenor.mp3'
      },
      {
        id: '9-2',
        name: '2 Tenor',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - 2 Tenor.mp3'
      },
      {
        id: '9-3',
        name: 'Barítono',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Barítono.mp3'
      },
      {
        id: '9-4',
        name: 'Baixo',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Baixo.mp3'
      },
      {
        id: '9-5',
        name: 'Original',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de um Rio - Cantado.mp3'
      },
      {
        id: '9-6',
        name: 'Playback',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Playback.mp3'
      }
    ]
  },
  {
    id: '10',
    title: 'Eu Não Sou Mais Eu',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '10-1',
        name: '1 Tenor',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - 1 Tenor.mp3'
      },
      {
        id: '10-2',
        name: '2 Tenor',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - 2 Tenor.mp3'
      },
      {
        id: '10-3',
        name: 'Barítono',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Barítono.mp3'
      },
      {
        id: '10-4',
        name: 'Baixo',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Baixo.mp3'
      },
      {
        id: '10-5',
        name: 'Original',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Cantado.mp3'
      },
      {
        id: '10-6',
        name: 'Playback',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Playback.mp3'
      }
    ]
  },
  {
    id: '11',
    title: 'Por Quê ó Pai?',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '11-1',
        name: '1 Tenor',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - 1 Tenor.mp3'
      },
      {
        id: '11-2',
        name: '2 Tenor',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - 2 Tenor.mp3'
      },
      {
        id: '11-3',
        name: 'Barítono',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Barítono.mp3'
      },
      {
        id: '11-4',
        name: 'Baixo',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Baixo.mp3'
      },
      {
        id: '11-5',
        name: 'Original',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Cantado.mp3'
      },
      {
        id: '11-6',
        name: 'Playback',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Playback.mp3'
      }
    ]
  }
];

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

interface SyncState {
  isPlaying: boolean;
  seekPosition: number;
  activeTracks: string[];
  soloedTracks: string[];
  trackVolumes: { [key: string]: number };
}

// Add helper functions before the HomePage component
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
  
  // Sync state
  const [deviceId] = useState(() => generateId());
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    isPlaying: false,
    seekPosition: 0,
    activeTracks: [],
    soloedTracks: [],
    trackVolumes: {}
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
    tracks: []
  });

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
        trackVolumes: {}
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
        trackVolumes: {}
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
          trackVolumes: data.trackVolumes || {}
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
              trackVolumes: {}
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
              trackVolumes: {}
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
      const playPromises = players.map(async (player, index) => {
        if (activeTrackIds.includes(selectedSong.tracks[index].id)) {
          console.log(`Starting track ${selectedSong.tracks[index].name}`);
          const status = await player.getStatusAsync();
          if (status.isLoaded) {
            await player.setPositionAsync(seekPosition * 1000);
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
        for (let i = 0; i < players.length; i++) {
          const status = await players[i].getStatusAsync();
          if (status.isLoaded) {
            const position = status.positionMillis / 1000;
            setTrackProgress(prev => ({
              ...prev,
              [selectedSong.tracks[i].id]: position
            }));
            setSeekPosition(position);
          }
        }
      }
    }, 50); // Increased update frequency for smoother progress

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized, selectedSong]);

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
    if (!searchQuery.trim()) return songs;
    
    const query = searchQuery.toLowerCase().trim();
    return songs.filter(song => 
      song.title.toLowerCase().includes(query) || 
      song.artist.toLowerCase().includes(query)
    );
  }, [searchQuery]);

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
      <Ionicons 
        name="chevron-forward" 
        size={24} 
        color="#BBBBBB" 
      />
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
        <View style={styles.dialogButtons}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonCancel]}
            onPress={() => setShowJoinDialog(false)}
          >
            <Text style={styles.dialogButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonJoin]}
            onPress={() => {
              if (joinSessionInput.trim()) {
                joinSession(joinSessionInput.trim());
                setShowJoinDialog(false);
                setJoinSessionInput('');
              }
            }}
          >
            <Text style={styles.dialogButtonText}>Join</Text>
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
          <TouchableOpacity 
            style={styles.copyButton}
            onPress={async () => {
              try {
                await Clipboard.setString(sessionId || '');
                Alert.alert('Success', 'Session ID copied to clipboard');
              } catch (error) {
                Alert.alert('Error', 'Failed to copy session ID');
              }
            }}
          >
            <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            <Text style={styles.copyButtonText}>Copy ID</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.copyButton, { backgroundColor: '#3D0C11' }]}
          onPress={() => setShowSessionIdDialog(false)}
        >
          <Ionicons name="close-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.copyButtonText}>Close</Text>
        </TouchableOpacity>
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
        trackVolumes: {}
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

  const renderSessionsList = () => (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialog}>
        <Text style={styles.dialogTitle}>Active Sessions</Text>
        {activeSessions.length === 0 ? (
          <Text style={styles.noSessionsText}>No active sessions found</Text>
        ) : (
          <ScrollView style={styles.sessionsList}>
            {activeSessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionItem}
                onPress={() => {
                  joinSession(session.id);
                  setShowSessionsList(false);
                }}
              >
                <View style={styles.sessionItemInfo}>
                  <Text style={styles.sessionItemId}>ID: {session.id.substring(0, 8)}...</Text>
                  <Text style={styles.sessionItemAdmin}>Admin: {session.admin.substring(0, 8)}...</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <View style={styles.dialogButtons}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonCancel]}
            onPress={() => setShowSessionsList(false)}
          >
            <Text style={styles.dialogButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonJoin]}
            onPress={() => {
              setShowSessionsList(false);
              setShowJoinDialog(true);
            }}
          >
            <Text style={styles.dialogButtonText}>Enter ID</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Modify the join button press handler
  const handleJoinPress = () => {
    setShowSessionsList(true);
  };

  const renderSessionMenu = () => (
    <View style={styles.sessionMenuContainer}>
      <TouchableOpacity 
        style={styles.sessionMenuHeader}
        onPress={() => setIsSessionMenuExpanded(!isSessionMenuExpanded)}
      >
        <Text style={styles.sessionMenuTitle}>Session Management</Text>
        <Ionicons 
          name={isSessionMenuExpanded ? 'chevron-up' : 'chevron-down'} 
          size={24} 
          color="#BBBBBB" 
        />
      </TouchableOpacity>
      
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
    </View>
  );

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
      const newId = (songs.length + 1).toString();
      
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
        tracks
      };

      // Add to songs array
      songs.push(songToAdd);

      // Reset form and close dialog
      setNewSong({
        title: '',
        artist: '',
        tracks: []
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
          
          <View style={styles.tracksHeader}>
            <Text style={styles.tracksTitle}>Tracks</Text>
            <TouchableOpacity
              style={styles.addTrackButton}
              onPress={addNewTrack}
            >
              <Ionicons name="add-circle" size={24} color="#BB86FC" />
              <Text style={styles.addTrackButtonText}>Add Track</Text>
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
                  style={styles.removeTrackButton}
                  onPress={() => removeTrack(track.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF5252" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.uploadButton}
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
                <Text style={styles.uploadButtonText}>
                  {track.file ? 'Change File' : 'Upload File'}
                </Text>
              </TouchableOpacity>
              {track.file && (
                <Text style={styles.fileName} numberOfLines={1}>
                  {track.file.name}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.dialogButtons}>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonCancel]}
            onPress={() => setShowAddSongDialog(false)}
          >
            <Text style={styles.dialogButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dialogButton, styles.dialogButtonJoin]}
            onPress={handleAddSong}
          >
            <Text style={styles.dialogButtonText}>Add Song</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Modify the song list view to include the add button
  const renderSongList = () => (
    <View style={styles.songListContainer}>
      <Text style={styles.title}>Select a Song</Text>
      {renderSessionMenu()}
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
      <TouchableOpacity 
        style={styles.addSongButton}
        onPress={() => setShowAddSongDialog(true)}
      >
        <Ionicons name="add-circle" size={24} color="#BB86FC" />
        <Text style={styles.addSongButtonText}>Add New Song</Text>
      </TouchableOpacity>
      <FlatList
        data={filteredSongs}
        renderItem={renderSongItem}
        keyExtractor={item => item.id}
        style={styles.songList}
      />
    </View>
  );

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
                <View style={[styles.songHeader, { flex: 1, marginRight: 12 }]}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setSelectedSong(null)}
                  >
                    <Ionicons name="chevron-back" size={24} color="#BB86FC" />
                  </TouchableOpacity>
                  <View style={styles.songHeaderText}>
                    <MarqueeText 
                      text={selectedSong.title} 
                      style={styles.title}
                    />
                    <Text style={styles.artist} numberOfLines={1}>
                      {selectedSong.artist}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.controlButton} 
                  onPress={togglePlayback}
                >
                  <Ionicons 
                    name={isPlaying ? 'pause-circle' : 'play-circle'} 
                    size={48} 
                    color="#BB86FC" 
                  />
                </TouchableOpacity>
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
                  onSlidingComplete={(value) => {
                    setIsSeeking(false);
                    handleSeek(selectedSong.tracks[0].id, value);
                  }}
                  onValueChange={(value) => {
                    setSeekPosition(value);
                  }}
                  minimumTrackTintColor="#BB86FC"
                  maximumTrackTintColor="#2C2C2C"
                />
                <Text style={styles.timeText}>
                  {formatTime(trackDurations[selectedSong.tracks[0]?.id] || 0)}
                </Text>
              </View>
            </View>
            
            <ScrollView style={styles.mainContent}>
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
            </ScrollView>
          </>
        )}
      </SafeAreaView>
      {showJoinDialog && renderJoinDialog()}
      {showSessionIdDialog && renderSessionIdDialog()}
      {showSessionsList && renderSessionsList()}
      {showAddSongDialog && renderAddSongDialog()}
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
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songHeaderText: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  artist: {
    fontSize: 14,
    color: '#BBBBBB',
    flexWrap: 'wrap',
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
    maxWidth: '40%',
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
    padding: 4,
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
    padding: 12
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2C',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionItemInfo: {
    flex: 1,
  },
  sessionItemId: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  sessionItemAdmin: {
    color: '#BBBBBB',
    fontSize: 12,
  },
  fullSessionId: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 6,
    textAlign: 'center',
    marginBottom: 16,
  },
  copyButton: {
    backgroundColor: '#BB86FC',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    marginTop: 16,
    marginBottom: 8,
  },
  tracksTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addTrackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 6,
  },
  addTrackButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  trackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackNameInput: {
    backgroundColor: '#2C2C2C',
    borderRadius: 6,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 14,
    marginRight: 8,
  },
  removeTrackButton: {
    padding: 4,
  },
  trackUploadContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  trackUploadLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  uploadButton: {
    backgroundColor: '#2C2C2C',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
  },
  fileName: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 4,
  },
});