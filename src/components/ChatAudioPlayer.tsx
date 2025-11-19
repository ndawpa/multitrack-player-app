import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AudioStorageService from '../services/audioStorage';

interface ChatAudioPlayerProps {
  path: string;
  name: string;
}

const ChatAudioPlayer: React.FC<ChatAudioPlayerProps> = ({ path, name }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [position, setPosition] = useState<number>(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadAudio();
    return () => {
      unloadAudio();
    };
  }, [path]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      const audioStorage = AudioStorageService.getInstance();
      const audioFile = await audioStorage.getAudioFile(path);
      const loadedSound = await audioStorage.loadAudioFile(audioFile);
      
      // Get duration
      const status = await loadedSound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis ? status.durationMillis / 1000 : null);
      }

      // Set up playback status listener
      loadedSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis ? status.positionMillis / 1000 : 0);
          setIsPlaying(status.isPlaying);
          
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        }
      });

      setSound(loadedSound);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error loading audio:', error);
      setHasError(true);
      setIsLoading(false);
      Alert.alert('Error', `Failed to load audio: ${error.message || 'Unknown error'}`);
    }
  };

  const unloadAudio = async () => {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Error unloading audio:', error);
      }
      setSound(null);
    }
  };

  const handlePlayPause = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error: any) {
      console.error('Error playing/pausing audio:', error);
      Alert.alert('Error', `Failed to play audio: ${error.message || 'Unknown error'}`);
    }
  };

  const formatTime = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="musical-notes-outline" size={24} color="#666" />
          <Text style={styles.errorText}>Unable to load audio</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="musical-notes" size={20} color="#BB86FC" />
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={styles.playerContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#BB86FC" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
              disabled={!sound}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(position)} / {formatTime(duration)}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#BB86FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#BBBBBB',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#BBBBBB',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#BBBBBB',
  },
});

export default ChatAudioPlayer;

