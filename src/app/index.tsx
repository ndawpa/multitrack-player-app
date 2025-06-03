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
  const [trackProgress, setTrackProgress] = useState<{ [key: string]: number }>({});
  const [trackDurations, setTrackDurations] = useState<{ [key: string]: number }>({});
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

        // Get durations
        loadedPlayers.forEach(async (player, index) => {
          const status = await player.getStatusAsync();
          if (status.isLoaded && status.durationMillis) {
            setTrackDurations(prev => ({
              ...prev,
              [tracks[index].id]: (status as { durationMillis: number }).durationMillis / 1000
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
          if (activeTrackIds.includes(tracks[i].id)) {
            const status = await players[i].getStatusAsync();
            if (status.isLoaded) {
              setTrackProgress(prev => ({
                ...prev,
                [tracks[i].id]: status.positionMillis / 1000
              }));
            }
          }
        }
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isPlaying, activeTrackIds, isSeeking, players, isInitialized]);

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

  const toggleTrack = async (trackId: string) => {
    if (!isInitialized) return;

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    const isActive = activeTrackIds.includes(trackId);
    
    if (isActive) {
      setActiveTrackIds(prev => prev.filter(id => id !== trackId));
      await player.setVolumeAsync(0);
    } else {
      setActiveTrackIds(prev => [...prev, trackId]);
      await player.setVolumeAsync(1);
    }
  };

  const handleSeek = async (trackId: string, value: number) => {
    if (!isInitialized) return;

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    if (!player) return;

    await player.setPositionAsync(value * 1000);
    setTrackProgress(prev => ({
      ...prev,
      [trackId]: value
    }));
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
          <Text style={styles.title}>Multitrack Player</Text>
        </View>
        
        <ScrollView style={styles.mainContent}>
          {tracks.map(track => (
            <View key={track.id} style={styles.trackContainer}>
              <View style={styles.trackInfo}>
                <Text style={styles.trackName}>{track.name}</Text>
                <TouchableOpacity 
                  style={styles.trackToggleButton} 
                  onPress={() => toggleTrack(track.id)}
                >
                  <Ionicons 
                    name={activeTrackIds.includes(track.id) ? 'volume-high' : 'volume-mute'} 
                    size={32} 
                    color="#007AFF" 
                  />
                </TouchableOpacity>
              </View>
              
              <View style={styles.seekbarContainer}>
                <Text style={styles.timeText}>
                  {formatTime(trackProgress[track.id] || 0)}
                </Text>
                <Slider
                  style={styles.seekbar}
                  minimumValue={0}
                  maximumValue={trackDurations[track.id] || 0}
                  value={trackProgress[track.id] || 0}
                  onSlidingStart={() => setIsSeeking(true)}
                  onSlidingComplete={(value) => {
                    setIsSeeking(false);
                    handleSeek(track.id, value);
                  }}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#ddd"
                />
                <Text style={styles.timeText}>
                  {formatTime(trackDurations[track.id] || 0)}
                </Text>
              </View>
            </View>
          ))}
          
          <View style={styles.controls}>
            <TouchableOpacity 
              style={styles.controlButton} 
              onPress={togglePlayback}
            >
              <Ionicons 
                name={isPlaying ? 'pause-circle' : 'play-circle'} 
                size={64} 
                color="#007AFF" 
              />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  statusBarBackground: {
    height: 24,
    backgroundColor: '#fff'
  },
  content: {
    flex: 1
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20
  },
  trackContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  trackName: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  trackToggleButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#e0e0e0'
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8
  },
  seekbar: {
    flex: 1,
    height: 40,
    marginHorizontal: 8
  },
  seekbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 5
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  controlButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 5
  }
});