import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Switch,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GroupService from '../services/groupService';
import SongAccessService from '../services/songAccessService';
import { UserGroup, AdminUserView } from '../types/group';

interface Song {
  id: string;
  title: string;
  artist: string;
  accessControl?: {
    allowedUsers?: string[];
    allowedGroups?: string[];
    visibility: 'public' | 'private' | 'group_restricted';
    accessLevel: 'read' | 'play' | 'download' | 'edit';
  };
}

interface SongAccessManagementProps {
  onClose: () => void;
  songs: Song[];
  onSongUpdate?: (songId: string, updates: any) => void;
  currentUserId?: string;
}

const SongAccessManagement: React.FC<SongAccessManagementProps> = ({ 
  onClose, 
  songs, 
  onSongUpdate,
  currentUserId = 'admin'
}) => {
  const [activeTab, setActiveTab] = useState<'songs' | 'groups' | 'bulk'>('songs');
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState<'read' | 'play' | 'download' | 'edit'>('play');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'group_restricted'>('public');

  const groupService = GroupService.getInstance();
  const songAccessService = SongAccessService.getInstance();

  useEffect(() => {
    loadData();
    
    const unsubscribeGroups = groupService.onGroupsChange(setGroups);
    const unsubscribeUsers = groupService.onUsersChange(setUsers);

    return () => {
      unsubscribeGroups();
      unsubscribeUsers();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, usersData] = await Promise.all([
        groupService.getAllGroups(),
        groupService.getAllUsersForAdmin()
      ]);
      setGroups(groupsData);
      setUsers(usersData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSongAccess = async () => {
    if (!selectedSong) return;

    try {
      await songAccessService.setSongAccess(selectedSong.id, {
        visibility,
        allowedGroups: selectedGroups,
        allowedUsers: selectedUsers,
        accessLevel
      });

      // Update the song in the parent component
      onSongUpdate?.(selectedSong.id, {
        accessControl: {
          visibility,
          allowedGroups: selectedGroups,
          allowedUsers: selectedUsers,
          accessLevel
        }
      });

      setShowAccessModal(false);
      setSelectedSong(null);
      setSelectedGroups([]);
      setSelectedUsers([]);
      Alert.alert('Success', 'Song access updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update song access');
    }
  };

  const handleBulkAccess = async () => {
    if (selectedGroups.length === 0 && selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select groups or users');
      return;
    }

    try {
      const selectedSongs = songs.filter(song => 
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );

      for (const song of selectedSongs) {
        await songAccessService.setSongAccess(song.id, {
          visibility,
          allowedGroups: selectedGroups,
          allowedUsers: selectedUsers,
          accessLevel
        });
      }

      Alert.alert('Success', `Access updated for ${selectedSongs.length} songs`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update bulk access');
    }
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAccessIcon = (song: Song) => {
    if (!song.accessControl) return 'globe-outline';
    switch (song.accessControl.visibility) {
      case 'public': return 'globe-outline';
      case 'private': return 'lock-closed-outline';
      case 'group_restricted': return 'people-outline';
      default: return 'globe-outline';
    }
  };

  const getAccessColor = (song: Song) => {
    if (!song.accessControl) return '#4CAF50';
    switch (song.accessControl.visibility) {
      case 'public': return '#4CAF50';
      case 'private': return '#FF6B6B';
      case 'group_restricted': return '#FF9800';
      default: return '#4CAF50';
    }
  };

  const renderSongItem = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={styles.songItem}
      onPress={() => {
        setSelectedSong(item);
        setSelectedGroups(item.accessControl?.allowedGroups || []);
        setSelectedUsers(item.accessControl?.allowedUsers || []);
        setVisibility(item.accessControl?.visibility || 'public');
        setAccessLevel(item.accessControl?.accessLevel || 'play');
        setShowAccessModal(true);
      }}
    >
      <View style={styles.songInfo}>
        <Ionicons 
          name={getAccessIcon(item)} 
          size={24} 
          color={getAccessColor(item)} 
        />
        <View style={styles.songDetails}>
          <Text style={styles.songTitle}>{item.title}</Text>
          <Text style={styles.songArtist}>{item.artist}</Text>
          <Text style={styles.songAccess}>
            {item.accessControl?.visibility || 'public'} • {item.accessControl?.accessLevel || 'play'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.header}>
          <Text style={styles.headerTitle}>Song Access Control</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.header}>
        <Text style={styles.headerTitle}>Song Access Control</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
          onPress={() => setActiveTab('songs')}
        >
          <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>
            Songs ({songs.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups ({groups.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bulk' && styles.activeTab]}
          onPress={() => setActiveTab('bulk')}
        >
          <Text style={[styles.tabText, activeTab === 'bulk' && styles.activeTabText]}>
            Bulk Access
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'songs' && (
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredSongs}
            keyExtractor={(item) => item.id}
            renderItem={renderSongItem}
            style={styles.list}
          />
        </View>
      )}

      {activeTab === 'groups' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Group Overview</Text>
          {groups.map(group => (
            <View key={group.id} style={styles.groupItem}>
              <View style={styles.groupDetails}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupDescription}>{group.description}</Text>
                <Text style={styles.groupMembers}>
                  {group.members?.length || 0} members
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'bulk' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Bulk Access Control</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs for bulk update..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <Text style={styles.subsectionTitle}>Select Groups</Text>
          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupSelectItem,
                selectedGroups.includes(group.id) && styles.selectedGroupItem
              ]}
              onPress={() => {
                if (selectedGroups.includes(group.id)) {
                  setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                } else {
                  setSelectedGroups([...selectedGroups, group.id]);
                }
              }}
            >
              <Text style={styles.groupSelectName}>{group.name}</Text>
              {selectedGroups.includes(group.id) && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.bulkButton, (selectedGroups.length === 0 && selectedUsers.length === 0) && styles.disabledButton]}
            onPress={handleBulkAccess}
            disabled={selectedGroups.length === 0 && selectedUsers.length === 0}
          >
            <Text style={styles.bulkButtonText}>
              Apply to {filteredSongs.length} songs
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Access Control Modal */}
      <Modal visible={showAccessModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Access Control: {selectedSong?.title}
            </Text>
            <TouchableOpacity onPress={() => setShowAccessModal(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Visibility</Text>
            <View style={styles.visibilityContainer}>
              {['public', 'private', 'group_restricted'].map((vis) => (
                <TouchableOpacity
                  key={vis}
                  style={[
                    styles.visibilityOption,
                    visibility === vis && styles.selectedVisibilityOption
                  ]}
                  onPress={() => setVisibility(vis as any)}
                >
                  <Ionicons 
                    name={vis === 'public' ? 'globe-outline' : vis === 'private' ? 'lock-closed-outline' : 'people-outline'} 
                    size={20} 
                    color={visibility === vis ? '#BB86FC' : '#666'} 
                  />
                  <Text style={[
                    styles.visibilityText,
                    visibility === vis && styles.selectedVisibilityText
                  ]}>
                    {vis.charAt(0).toUpperCase() + vis.slice(1).replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Access Level</Text>
            <View style={styles.accessLevelContainer}>
              {['read', 'play', 'download', 'edit'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.accessLevelOption,
                    accessLevel === level && styles.selectedAccessLevelOption
                  ]}
                  onPress={() => setAccessLevel(level as any)}
                >
                  <Text style={[
                    styles.accessLevelText,
                    accessLevel === level && styles.selectedAccessLevelText
                  ]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visibility === 'group_restricted' && (
              <>
                <Text style={styles.sectionTitle}>Allowed Groups</Text>
                {groups.map(group => (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.groupSelectItem,
                      selectedGroups.includes(group.id) && styles.selectedGroupItem
                    ]}
                    onPress={() => {
                      if (selectedGroups.includes(group.id)) {
                        setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                      } else {
                        setSelectedGroups([...selectedGroups, group.id]);
                      }
                    }}
                  >
                    <Text style={styles.groupSelectName}>{group.name}</Text>
                    {selectedGroups.includes(group.id) && (
                      <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAccessModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitButton} onPress={handleSongAccess}>
              <Text style={styles.submitButtonText}>Save Access</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#121212',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#BB86FC',
  },
  tabText: {
    color: '#666',
    fontSize: 16,
  },
  activeTabText: {
    color: '#BB86FC',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  songInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songDetails: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  songArtist: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  songAccess: {
    color: '#BB86FC',
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subsectionTitle: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupDescription: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  groupMembers: {
    color: '#BB86FC',
    fontSize: 12,
    marginTop: 2,
  },
  groupSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedGroupItem: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  groupSelectName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  bulkButton: {
    backgroundColor: '#BB86FC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  bulkButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  visibilityContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedVisibilityOption: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  visibilityText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  selectedVisibilityText: {
    color: '#BB86FC',
  },
  accessLevelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  accessLevelOption: {
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
  },
  selectedAccessLevelOption: {
    backgroundColor: '#BB86FC',
  },
  accessLevelText: {
    color: '#666',
    fontSize: 14,
  },
  selectedAccessLevelText: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#BB86FC',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default SongAccessManagement;
