import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { storage } from '../config/firebase';

interface AudioFile {
  id: string;
  name: string;
  url: string;
  localUri?: string;
}

class AudioStorageService {
  private static instance: AudioStorageService;
  private cacheDirectory = `${FileSystem.cacheDirectory}audio/`;

  private constructor() {
    // Initialize cache directory
    FileSystem.makeDirectoryAsync(this.cacheDirectory, { intermediates: true })
      .catch(error => console.log('Cache directory already exists:', error));
  }

  public static getInstance(): AudioStorageService {
    if (!AudioStorageService.instance) {
      AudioStorageService.instance = new AudioStorageService();
    }
    return AudioStorageService.instance;
  }

  async uploadAudioFile(fileUri: string, path: string): Promise<string> {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

  async getAudioFile(path: string): Promise<AudioFile> {
    try {
      // Check if file is cached
      const localUri = `${this.cacheDirectory}${path.split('/').pop()}`;
      const fileInfo = await FileSystem.getInfoAsync(localUri);

      if (fileInfo.exists) {
        return {
          id: path,
          name: path.split('/').pop() || '',
          url: path,
          localUri
        };
      }

      // If not cached, download and cache
      const storageRef = ref(storage, path);
      const url = await getDownloadURL(storageRef);
      
      const downloadResult = await FileSystem.downloadAsync(url, localUri);
      
      return {
        id: path,
        name: path.split('/').pop() || '',
        url,
        localUri: downloadResult.uri
      };
    } catch (error) {
      console.error('Error getting audio file:', error);
      throw error;
    }
  }

  async loadAudioFile(audioFile: AudioFile): Promise<Audio.Sound> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioFile.localUri || audioFile.url },
        { shouldPlay: false }
      );
      return sound;
    } catch (error) {
      console.error('Error loading audio file:', error);
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(this.cacheDirectory, { idempotent: true });
      await FileSystem.makeDirectoryAsync(this.cacheDirectory, { intermediates: true });
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
}

export default AudioStorageService; 