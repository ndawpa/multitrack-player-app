import { ref, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
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

  async pickAudioFile(): Promise<DocumentPicker.DocumentPickerAsset | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });
      
      if (result.assets && result.assets.length > 0) {
        return result.assets[0];
      }
      return null;
    } catch (error) {
      console.error('Error picking audio file:', error);
      throw error;
    }
  }

  async pickMultipleAudioFiles(): Promise<DocumentPicker.DocumentPickerAsset[]> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: true
      });
      
      if (result.assets && result.assets.length > 0) {
        return result.assets;
      }
      return [];
    } catch (error) {
      console.error('Error picking multiple audio files:', error);
      throw error;
    }
  }

  async uploadAudioFile(file: DocumentPicker.DocumentPickerAsset, path: string): Promise<string> {
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

  async deleteAudioFile(path: string): Promise<void> {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting audio file:', error);
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