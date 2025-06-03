import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlayer, AudioModule } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface Track {
  id: string;
  name: string;
  audioFile: any;
}

const tracks: Track[] = [
  {
    id: '1',
    name: 'Demo Track 1',
    audioFile: require('../../assets/audio/demo-track-1.mp3')
  },
  {
    id: '2',
    name: 'Demo Track 2',
    audioFile: require('../../assets/audio/demo-track-2.mp3')
  }
];

export default function HomePage() {
  const players = tracks.map(track => useAudioPlayer(track.audioFile));
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIds, setActiveTrackIds] = useState<string[]>([]);

  useEffect(() => {
    // Initialize all players with volume 0
    players.forEach(player => {
      player.volume = 0;
    });
    return () => {
      players.forEach(player => {
        player.pause();
      });
    };
  }, []);

  const toggleTrack = async (trackId: string) => {
    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    const player = players[trackIndex];
    const isActive = activeTrackIds.includes(trackId);
    
    // Toggle volume between 0 and 1
    player.volume = isActive ? 0 : 1;

    if (isActive) {
      setActiveTrackIds(prev => prev.filter(id => id !== trackId));
      await player.pause();
    } else {
      setActiveTrackIds(prev => [...prev, trackId]);
      if (isPlaying) {
        await player.play();
      }
    }
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        await Promise.all(players.map(player => player.pause()));
      } else {
        const activePlayers = players.filter((_, index) => 
          activeTrackIds.includes(tracks[index].id)
        );
        await Promise.all(activePlayers.map(player => player.play()));
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="dark" />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Multitrack Player</Text>
        </View>
        
        <View style={styles.mainContent}>
          {tracks.map(track => (
            <View key={track.id} style={styles.trackContainer}>
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
          ))}
          
          <TouchableOpacity 
            style={styles.playButton} 
            onPress={togglePlayback}
          >
            <Ionicons 
              name={isPlaying ? 'pause-circle' : 'play-circle'} 
              size={64} 
              color="#007AFF" 
            />
          </TouchableOpacity>
        </View>
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
    padding: 20,
    justifyContent: 'center',
  },
  trackContainer: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  trackName: {
    fontSize: 18,
    fontWeight: '600',
  },
  trackToggleButton: {
    padding: 8,
  },
  playButton: {
    alignItems: 'center',
    marginTop: 20,
  }
});