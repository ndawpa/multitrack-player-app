import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlaylistService from '../services/playlistService';
import { Playlist, CreatePlaylistForm, PlaylistItem } from '../types/playlist';
import { Song } from '../types/song';
import { User } from '../types/user';
import Header from './Header';
import Button from './Button';
import { commonStyles, spacingStyles } from '../theme/layout';

interface PlaylistScreenProps {
  onBack: () => void;
  onPlayPlaylist: (playlist: Playlist, songs: Song[]) => void;
  user: User | null;
  availableSongs: Song[];
}

const PlaylistScreen: React.FC<PlaylistScreenProps> = ({ 
  onBack, 
  onPlayPlaylist,
  user,
  availableSongs 
}) => {
  const insets = useSafeAreaInsets();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  
  const [showPlaylistDetails, setShowPlaylistDetails] = useState(false);
  
  // Create playlist form
  const [newPlaylist, setNewPlaylist] = useState<CreatePlaylistForm>({
    name: '',
    description: '',
    isPublic: false
  });

  const playlistService = PlaylistService.getInstance();

  useEffect(() => {
    if (user) {
      loadPlaylists();
    }
  }, [user]);


  const loadPlaylists = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userPlaylists = await playlistService.getUserPlaylists(user.id);
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      Alert.alert('Error', 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!user || !newPlaylist.name.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    try {
      await playlistService.createPlaylist(user.id, newPlaylist);
      setNewPlaylist({ name: '', description: '', isPublic: false });
      setShowCreateModal(false);
      loadPlaylists();
      Alert.alert('Success', 'Playlist created successfully');
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await playlistService.deletePlaylist(playlist.id);
              loadPlaylists();
              Alert.alert('Success', 'Playlist deleted successfully');
            } catch (error) {
              console.error('Error deleting playlist:', error);
              Alert.alert('Error', 'Failed to delete playlist');
            }
          }
        }
      ]
    );
  };

  const handlePlayPlaylist = async (playlist: Playlist) => {
    try {
      const { songs } = await playlistService.getPlaylistSongs(playlist.id);
      if (songs.length === 0) {
        Alert.alert('Empty Playlist', 'This playlist has no songs');
        return;
      }
      onPlayPlaylist(playlist, songs);
    } catch (error) {
      console.error('Error loading playlist songs:', error);
      Alert.alert('Error', 'Failed to load playlist songs');
    }
  };

  const handleViewPlaylistDetails = async (playlist: Playlist) => {
    try {
      const { playlist: freshPlaylist, songs } = await playlistService.getPlaylistSongs(playlist.id);
      
      console.log('Playlist details loaded:', {
        playlistItems: freshPlaylist.songs?.length || 0,
        songs: songs.length
      });
      
      setSelectedPlaylist(freshPlaylist);
      setPlaylistSongs(songs);
      setPlaylistItems(freshPlaylist.songs || []);
      setShowPlaylistDetails(true);
    } catch (error) {
      console.error('Error loading playlist details:', error);
      Alert.alert('Error', 'Failed to load playlist details');
    }
  };

  const handleAddSongToPlaylist = async (song: Song) => {
    if (!selectedPlaylist) return;

    // Validate song data
    if (!song || !song.id || !song.title || !song.artist) {
      Alert.alert('Error', 'Invalid song data');
      return;
    }

    try {
      await playlistService.addSongToPlaylist(selectedPlaylist.id, {
        songId: song.id
      }, song);
      setShowAddSongModal(false);
      handleViewPlaylistDetails(selectedPlaylist); // Refresh details
      Alert.alert('Success', 'Song added to playlist');
    } catch (error) {
      console.error('Error adding song to playlist:', error);
      Alert.alert('Error', 'Failed to add song to playlist');
    }
  };

  const handleRemoveSongFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;

    console.log('Removing song from playlist:', { songId, playlistId: selectedPlaylist.id });

    try {
      await playlistService.removeSongFromPlaylist(selectedPlaylist.id, songId);
      // Refresh the playlist details to get updated data
      const { playlist: updatedPlaylist, songs } = await playlistService.getPlaylistSongs(selectedPlaylist.id);
      setPlaylistSongs(songs);
      setPlaylistItems(updatedPlaylist.songs || []);
      setSelectedPlaylist(updatedPlaylist);
      Alert.alert('Success', 'Song removed from playlist');
    } catch (error) {
      console.error('Error removing song from playlist:', error);
      Alert.alert('Error', 'Failed to remove song from playlist');
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity 
      style={styles.playlistItem}
      onPress={() => handlePlayPlaylist(item)}
    >
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.playlistMeta}>
          {item.songs.length} song{item.songs.length !== 1 ? 's' : ''} • 
          Updated {formatDate(item.updatedAt)}
        </Text>
        {item.description && (
          <Text style={styles.playlistDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      
      <View style={styles.playlistActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the tile click
            handleViewPlaylistDetails(item);
          }}
        >
          <Ionicons name="list" size={20} color="#BB86FC" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation(); // Prevent triggering the tile click
            handleDeletePlaylist(item.id);
          }}
        >
          <Ionicons name="trash" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderSongItem = ({ item, index }: { item: Song; index: number }) => {
    // Find the corresponding PlaylistItem for this Song
    const playlistItem = playlistItems.find(pi => pi.songId === item.id);
    const songId = playlistItem?.songId || item.id; // Fallback to item.id if not found
    
    // Ensure we have a valid songId before rendering the remove button
    if (!songId) {
      console.error('No valid songId found for song:', item);
      return null;
    }
    
    return (
      <View style={styles.songItem}>
        <View style={styles.songInfo}>
          <Text style={styles.songNumber}>{index + 1}</Text>
          <View style={styles.songDetails}>
            <Text style={styles.songTitle}>{item.title}</Text>
            <Text style={styles.songArtist}>{item.artist}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveSongFromPlaylist(songId)}
        >
          <Ionicons name="close-circle" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderAvailableSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={styles.availableSongItem}
      onPress={() => handleAddSongToPlaylist(item)}
    >
      <View style={styles.songInfo}>
        <View style={styles.songDetails}>
          <Text style={styles.songTitle}>{item?.title || 'Unknown Title'}</Text>
          <Text style={styles.songArtist}>{item?.artist || 'Unknown Artist'}</Text>
        </View>
      </View>
      <Ionicons name="add-circle" size={24} color="#BB86FC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading playlists...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container}>
      <Header 
        title="My Playlists" 
        onBack={onBack}
        rightComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#BB86FC" />
          </TouchableOpacity>
        }
      />

      {/* Playlists List */}
      <View style={styles.content}>
        {playlists.length === 0 ? (
          <View style={commonStyles.emptyState}>
            <Ionicons name="musical-notes" size={64} color="#666666" />
            <Text style={commonStyles.emptyTitle}>No Playlists Yet</Text>
            <Text style={commonStyles.emptySubtitle}>
              Create your first playlist to organize your favorite songs
            </Text>
            <Button
              title="Create Playlist"
              onPress={() => setShowCreateModal(true)}
              variant="primary"
              size="large"
              style={styles.createFirstButton}
            />
          </View>
        ) : (
          <FlatList
            data={playlists}
            renderItem={renderPlaylistItem}
            keyExtractor={(item) => `playlist-${item.id}`}
            contentContainerStyle={styles.playlistList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={commonStyles.modalContainer}>
          <View style={commonStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Playlist</Text>
            <Button
              title="Save"
              onPress={handleCreatePlaylist}
              variant="primary"
              size="medium"
            />
          </View>

          <ScrollView style={commonStyles.modalContent}>
            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                value={newPlaylist.name}
                onChangeText={(text) => setNewPlaylist({ ...newPlaylist, name: text })}
                placeholder="Enter playlist name"
                placeholderTextColor="#666666"
              />
            </View>

            <View style={commonStyles.inputGroup}>
              <Text style={commonStyles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newPlaylist.description}
                onChangeText={(text) => setNewPlaylist({ ...newPlaylist, description: text })}
                placeholder="Enter playlist description (optional)"
                placeholderTextColor="#666666"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={commonStyles.inputGroup}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNewPlaylist({ ...newPlaylist, isPublic: !newPlaylist.isPublic })}
              >
                <Ionicons
                  name={newPlaylist.isPublic ? "checkbox" : "square-outline"}
                  size={24}
                  color="#BB86FC"
                />
                <Text style={styles.checkboxLabel}>Make this playlist public</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Playlist Details Modal */}
      <Modal
        visible={showPlaylistDetails}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={commonStyles.modalContainer}>
          <View style={commonStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPlaylistDetails(false)}>
              <Text style={styles.modalCancelText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedPlaylist?.name}
            </Text>
            <Button
              title="Add Songs"
              onPress={() => setShowAddSongModal(true)}
              variant="primary"
              size="medium"
            />
          </View>

          <View style={commonStyles.modalContent}>
            {playlistSongs.length === 0 ? (
              <View style={styles.emptyPlaylist}>
                <Ionicons name="musical-notes" size={48} color="#666666" />
                <Text style={styles.emptyPlaylistText}>No songs in this playlist</Text>
                <Button
                  title="Add Songs"
                  onPress={() => setShowAddSongModal(true)}
                  variant="primary"
                  size="large"
                  style={styles.addSongsButton}
                />
              </View>
            ) : (
              <FlatList
                data={playlistSongs}
                renderItem={renderSongItem}
                keyExtractor={(item, index) => `playlist-song-${item.id}-${index}`}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add Songs Modal */}
      <Modal
        visible={showAddSongModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={commonStyles.modalContainer}>
          <View style={commonStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddSongModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Songs</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={commonStyles.modalContent}>
            <FlatList
              data={availableSongs}
              renderItem={renderAvailableSongItem}
              keyExtractor={(item, index) => `available-song-${item.id}-${index}`}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  playlistList: {
    padding: 16,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    // Add subtle visual feedback for clickable tile
    opacity: 1,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  playlistMeta: {
    fontSize: 14,
    color: '#BBBBBB',
    marginBottom: 4,
  },
  playlistDescription: {
    fontSize: 14,
    color: '#999999',
  },
  playlistActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  createFirstButton: {
    marginTop: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  modalCancelText: {
    color: '#BB86FC',
    fontSize: 16,
  },
  textInput: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  songNumber: {
    fontSize: 16,
    color: '#BB86FC',
    fontWeight: 'bold',
    width: 24,
    textAlign: 'center',
  },
  songDetails: {
    marginLeft: 12,
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  songArtist: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  availableSongItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  emptyPlaylist: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyPlaylistText: {
    fontSize: 18,
    color: '#BBBBBB',
    marginTop: 16,
    marginBottom: 24,
  },
  addSongsButton: {
    marginTop: 24,
  },
});

export default PlaylistScreen;
