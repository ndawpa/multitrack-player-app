import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAudioPlayer } from 'expo-audio';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface Track {
  id: string;
  name: string;
  audioFile: string;
}

const defaultTrack: Track = {
  id: '1',
  name: 'Demo Track',
  audioFile: require('../../assets/audio/demo-track.mp3')
};

export default function HomePage() {
  const player = useAudioPlayer(defaultTrack.audioFile);
  const [isPlaying, setIsPlaying] = useState(false);

  async function togglePlayback() {
    if (isPlaying) {
      await player.pause();
    } else {
      await player.play();
    }
    setIsPlaying(!isPlaying);
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBarBackground} />
      <StatusBar style="dark" />
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Multitrack Player</Text>
        </View>
        
        <View style={styles.mainContent}>
          <View style={styles.trackContainer}>
            <Text style={styles.trackName}>{defaultTrack.name}</Text>
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
    alignItems: 'center',
    elevation: 2,
  },
  trackName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  playButton: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});