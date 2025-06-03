import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import { useEffect, useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface Track {
  id: string;
  name: string;
  audioFile: any;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  tracks: Track[];
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
        audioFile: require('../../assets/audio/1tenor.mp3')
      },
      {
        id: '1-2',
        name: '2 Tenor',
        audioFile: require('../../assets/audio/2tenor.mp3')
      },
      {
        id: '1-3',
        name: 'Barítono',
        audioFile: require('../../assets/audio/barítono.mp3')
      },
      {
        id: '1-4',
        name: 'Baixo',
        audioFile: require('../../assets/audio/baixo.mp3')
      },
      {
        id: '1-5',
        name: 'Original',
        audioFile: require('../../assets/audio/original.mp3')
      },
      {
        id: '1-6',
        name: 'Playback',
        audioFile: require('../../assets/audio/playback.mp3')
      }
    ]
  },
  // Add more songs here with their tracks
];

export default function HomePage() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [players, setPlayers] = useState<Audio.Sound[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIds, setActiveTrackIds] = useState<string[]>([]);
  const [soloedTrackIds, setSoloedTrackIds] = useState<string[]>([]);
  const [trackProgress, setTrackProgress] = useState<{ [key: string]: number }>({});
  const [trackDurations, setTrackDurations] = useState<{ [key: string]: number }>({});
  const [trackVolumes, setTrackVolumes] = useState<{ [key: string]: number }>({});
  const [isSeeking, setIsSeeking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize players when a song is selected
  useEffect(() => {
    const initializePlayers = async () => {
      if (!selectedSong) return;

      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        // Unload previous players
        await Promise.all(players.map(player => player.unloadAsync()));

        const loadedPlayers = await Promise.all(
          selectedSong.tracks.map(async (track) => {
            const { sound } = await Audio.Sound.createAsync(track.audioFile);
            return sound;
          })
        );

        setPlayers(loadedPlayers);
        setIsInitialized(true);

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

  useEffect(() => {
    const progressInterval = setInterval(async () => {
      if (isPlaying && !isSeeking && selectedSong) {
        for (let i = 0; i < players.length; i++) {
          const status = await players[i].getStatusAsync();
          if (status.isLoaded) {
            setTrackProgress(prev => ({
              ...prev,
              [selectedSong.tracks[i].id]: status.positionMillis / 1000
            }));
          }
        }
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized, selectedSong]);

  const togglePlayback = async () => {
    try {
      if (!isInitialized || !selectedSong) return;

      if (isPlaying) {
        await Promise.all(players.map(player => player.pauseAsync()));
      } else {
        await Promise.all(
          players.map((player, index) => {
            if (activeTrackIds.includes(selectedSong.tracks[index].id)) {
              return player.playAsync();
            }
            return Promise.resolve();
          })
        );
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

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

  const handleSeek = async (trackId: string, value: number) => {
    if (!isInitialized || !selectedSong) return;

    await Promise.all(
      players.map(async (player) => {
        await player.setPositionAsync(value * 1000);
      })
    );

    setTrackProgress(prev => {
      const newProgress = { ...prev };
      selectedSong.tracks.forEach(track => {
        newProgress[track.id] = value;
      });
      return newProgress;
    });
  };

  // Add this helper function before the HomePage component
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSongSelect = (song: Song) => {
    setIsPlaying(false);
    setSelectedSong(song);
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="light" />
      <SafeAreaView style={styles.content}>
        {!selectedSong ? (
          // Song Selection View
          <View style={styles.songListContainer}>
            <Text style={styles.title}>Select a Song</Text>
            <FlatList
              data={songs}
              renderItem={renderSongItem}
              keyExtractor={item => item.id}
              style={styles.songList}
            />
          </View>
        ) : (
          // Track Player View
          <>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.songHeader}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setSelectedSong(null)}
                  >
                    <Ionicons name="chevron-back" size={24} color="#BB86FC" />
                  </TouchableOpacity>
                  <View>
                    <Text style={styles.title}>{selectedSong.title}</Text>
                    <Text style={styles.artist}>{selectedSong.artist}</Text>
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
                  value={trackProgress[selectedSong.tracks[0]?.id] || 0}
                  onSlidingStart={() => setIsSeeking(true)}
                  onSlidingComplete={(value) => {
                    setIsSeeking(false);
                    handleSeek(selectedSong.tracks[0].id, value);
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
                    </View>
                  </View>
                  <View style={styles.volumeContainer}>
                    <Ionicons name="volume-low" size={20} color="#BBBBBB" />
                    <Slider
                      style={styles.volumeSlider}
                      minimumValue={0}
                      maximumValue={1}
                      value={trackVolumes[track.id] || 1}
                      onValueChange={(value) => handleVolumeChange(track.id, value)}
                      minimumTrackTintColor="#BB86FC"
                      maximumTrackTintColor="#2C2C2C"
                    />
                    <Ionicons name="volume-high" size={20} color="#BBBBBB" />
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
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
  seekbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
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
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  artist: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 2,
  },
});