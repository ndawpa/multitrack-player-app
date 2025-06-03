import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
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

const tracks: Track[] = [
  {
    id: '1',
    name: '1 Tenor',
    audioFile: require('../../assets/audio/1tenor.mp3')
  },
  {
    id: '2',
    name: '2 Tenor',
    audioFile: require('../../assets/audio/2tenor.mp3')
  },
  {
    id: '3',
    name: 'Barítono',
    audioFile: require('../../assets/audio/barítono.mp3')
  },
  {
    id: '4',
    name: 'Baixo',
    audioFile: require('../../assets/audio/baixo.mp3')
  },
  {
    id: '5',
    name: 'Original',
    audioFile: require('../../assets/audio/original.mp3')
  },
  {
    id: '6',
    name: 'Playback',
    audioFile: require('../../assets/audio/playback.mp3')
  }
];

export default function HomePage() {
  const [players, setPlayers] = useState<Audio.Sound[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIds, setActiveTrackIds] = useState<string[]>(tracks.map(track => track.id));
  const [soloedTrackIds, setSoloedTrackIds] = useState<string[]>([]);
  const [trackProgress, setTrackProgress] = useState<{ [key: string]: number }>({});
  const [trackDurations, setTrackDurations] = useState<{ [key: string]: number }>({});
  const [trackVolumes, setTrackVolumes] = useState<{ [key: string]: number }>({});
  const [isSeeking, setIsSeeking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize players
  useEffect(() => {
    const initializePlayers = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        const loadedPlayers = await Promise.all(
          tracks.map(async (track) => {
            const { sound } = await Audio.Sound.createAsync(track.audioFile);
            return sound;
          })
        );

        setPlayers(loadedPlayers);
        setIsInitialized(true);

        // Initialize volumes
        const initialVolumes = tracks.reduce((acc, track) => ({
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
              [tracks[index].id]: status.durationMillis! / 1000
            }));
          }
        });
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
  }, []);

  useEffect(() => {
    if (!isInitialized || players.length === 0) return;

    const progressInterval = setInterval(async () => {
      if (isPlaying && !isSeeking) {
        for (let i = 0; i < players.length; i++) {
          const status = await players[i].getStatusAsync();
          if (status.isLoaded) {
            setTrackProgress(prev => ({
              ...prev,
              [tracks[i].id]: status.positionMillis / 1000
            }));
          }
        }
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isPlaying, isSeeking, players, isInitialized]);

  const togglePlayback = async () => {
    try {
      if (!isInitialized) return;

      if (isPlaying) {
        await Promise.all(players.map(player => player.pauseAsync()));
      } else {
        await Promise.all(
          players.map((player, index) => {
            if (activeTrackIds.includes(tracks[index].id)) {
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
    if (!isInitialized) return;

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    const isSoloed = soloedTrackIds.includes(trackId);
    let newSoloedTrackIds: string[];

    if (isSoloed) {
      // Remove from soloed tracks
      newSoloedTrackIds = soloedTrackIds.filter(id => id !== trackId);
    } else {
      // Add to soloed tracks
      newSoloedTrackIds = [...soloedTrackIds, trackId];
    }
    setSoloedTrackIds(newSoloedTrackIds);

    // Update volumes based on new solo state
    tracks.forEach(async (track, index) => {
      const isActive = activeTrackIds.includes(track.id);
      if (newSoloedTrackIds.length === 0) {
        // If no tracks are soloed, restore to mute state
        await players[index].setVolumeAsync(isActive ? (trackVolumes[track.id] || 1) : 0);
      } else {
        // If some tracks are soloed, only those tracks should be audible
        await players[index].setVolumeAsync(
          newSoloedTrackIds.includes(track.id) ? (trackVolumes[track.id] || 1) : 0
        );
      }
    });
  };

  const handleVolumeChange = async (trackId: string, value: number) => {
    if (!isInitialized) return;

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    // Update volume state
    setTrackVolumes(prev => ({
      ...prev,
      [trackId]: value
    }));

    // Update volume if track is soloed or if no tracks are soloed
    if (soloedTrackIds.includes(trackId) || soloedTrackIds.length === 0) {
      await player.setVolumeAsync(value);
    }
  };

  const toggleTrack = async (trackId: string) => {
    if (!isInitialized) return;

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    const isActive = activeTrackIds.includes(trackId);
    
    if (isActive) {
      setActiveTrackIds(prev => prev.filter(id => id !== trackId));
      // Only mute if not soloed
      if (!soloedTrackIds.includes(trackId)) {
        await player.setVolumeAsync(0);
      }
    } else {
      setActiveTrackIds(prev => [...prev, trackId]);
      // Only unmute if not soloed
      if (soloedTrackIds.length === 0 || soloedTrackIds.includes(trackId)) {
        const volume = trackVolumes[trackId] || 1;
        await player.setVolumeAsync(volume);
      }
    }
  };

  const handleSeek = async (trackId: string, value: number) => {
    if (!isInitialized) return;

    // Update all players to the same position regardless of their state
    await Promise.all(
      players.map(async (player) => {
        await player.setPositionAsync(value * 1000);
      })
    );

    // Update progress for all tracks
    setTrackProgress(prev => {
      const newProgress = { ...prev };
      tracks.forEach(track => {
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

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="dark" />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Multitrack Player</Text>
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
              {formatTime(trackProgress[tracks[0]?.id] || 0)}
            </Text>
            <Slider
              style={styles.seekbar}
              minimumValue={0}
              maximumValue={trackDurations[tracks[0]?.id] || 0}
              value={trackProgress[tracks[0]?.id] || 0}
              onSlidingStart={() => setIsSeeking(true)}
              onSlidingComplete={(value) => {
                setIsSeeking(false);
                handleSeek(tracks[0].id, value);
              }}
              minimumTrackTintColor="#BB86FC"
              maximumTrackTintColor="#2C2C2C"
            />
            <Text style={styles.timeText}>
              {formatTime(trackDurations[tracks[0]?.id] || 0)}
            </Text>
          </View>
        </View>
        
        <ScrollView style={styles.mainContent}>
          {tracks.map(track => (
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
  }
});