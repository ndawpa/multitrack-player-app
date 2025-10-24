import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SongAccessService from '../services/songAccessService';
import TenantService from '../services/tenantService';
import { Song } from '../types/song';
import { Organization, SongAccess } from '../types/tenant';

interface SongAssignmentScreenProps {
  onBack: () => void;
  tenantId: string;
  organizationId?: string;
  userId: string;
}

const SongAssignmentScreen: React.FC<SongAssignmentScreenProps> = ({ 
  onBack, 
  tenantId, 
  organizationId, 
  userId 
}) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [songAccess, setSongAccess] = useState<SongAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignSong, setShowAssignSong] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedTargetOrg, setSelectedTargetOrg] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'public' | 'private' | 'restricted'>('public');
  
  const songAccessService = SongAccessService.getInstance();
  const tenantService = TenantService.getInstance();

  useEffect(() => {
    loadData();
  }, [tenantId, organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load songs for this tenant
      const tenantSongs = await songAccessService.getSongsByTenant(tenantId);
      setSongs(tenantSongs);
      
      // Load organizations in this tenant
      const tenantOrgs = await tenantService.getOrganizationsByTenant(tenantId);
      setOrganizations(tenantOrgs);
      
      // Load song access records
      // In a real app, you'd have a method to get song access records
      setSongAccess([]);
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load song data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSong = async () => {
    try {
      if (!selectedSong || !selectedTargetOrg) {
        Alert.alert('Error', 'Please select a song and target organization');
        return;
      }

      await songAccessService.assignSongToOrganization(
        selectedSong.id,
        selectedTargetOrg,
        selectedAccessLevel
      );

      Alert.alert(
        'Success', 
        `Song "${selectedSong.title}" has been assigned to the organization with ${selectedAccessLevel} access.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowAssignSong(false);
              setSelectedSong(null);
              setSelectedTargetOrg('');
              setSelectedAccessLevel('public');
              loadData();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error assigning song:', error);
      Alert.alert('Error', 'Failed to assign song');
    }
  };

  const handleRemoveSongAccess = async (songId: string, orgId: string) => {
    Alert.alert(
      'Remove Song Access',
      'Are you sure you want to remove this song from the organization?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // In a real app, you'd remove the song access record
              Alert.alert('Success', 'Song access removed successfully');
              loadData();
            } catch (error) {
              console.error('Error removing song access:', error);
              Alert.alert('Error', 'Failed to remove song access');
            }
          }
        }
      ]
    );
  };

  const renderSong = ({ item }: { item: Song }) => (
    <TouchableOpacity
      style={styles.songCard}
      onPress={() => {
        setSelectedSong(item);
        setShowAssignSong(true);
      }}
    >
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
        <Text style={styles.songMeta}>
          Tracks: {item.tracks?.length || 0} | 
          Access: {item.accessLevel || 'Not assigned'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
    </TouchableOpacity>
  );

  const renderAccessLevel = (level: 'public' | 'private' | 'restricted') => {
    const colors = {
      public: '#4CAF50',
      private: '#FF9800',
      restricted: '#F44336'
    };
    
    return (
      <View style={[styles.accessLevelBadge, { backgroundColor: colors[level] }]}>
        <Text style={styles.accessLevelText}>{level.toUpperCase()}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Song Assignment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Songs</Text>
          <Text style={styles.sectionSubtitle}>
            Click on a song to assign it to an organization
          </Text>
          
          {songs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No songs found</Text>
              <Text style={styles.emptySubtext}>Create songs first to assign them to organizations</Text>
            </View>
          ) : (
            <FlatList
              data={songs}
              renderItem={renderSong}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {songAccess.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Assignments</Text>
            <Text style={styles.sectionSubtitle}>
              Songs currently assigned to organizations
            </Text>
            
            {songAccess.map((access) => {
              const song = songs.find(s => s.id === access.songId);
              const org = organizations.find(o => o.id === access.organizationId);
              
              return (
                <View key={access.id} style={styles.assignmentCard}>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentSong}>
                      {song?.title || 'Unknown Song'}
                    </Text>
                    <Text style={styles.assignmentOrg}>
                      → {org?.name || 'Unknown Organization'}
                    </Text>
                    <View style={styles.assignmentMeta}>
                      {renderAccessLevel(access.accessLevel)}
                      <Text style={styles.assignmentDate}>
                        {new Date(access.grantedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveSongAccess(access.songId, access.organizationId || '')}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Assign Song Modal */}
      <Modal
        visible={showAssignSong}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAssignSong(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Song</Text>
            <TouchableOpacity onPress={handleAssignSong}>
              <Text style={styles.modalSave}>Assign</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {selectedSong && (
              <View style={styles.selectedSongInfo}>
                <Text style={styles.selectedSongTitle}>{selectedSong.title}</Text>
                <Text style={styles.selectedSongArtist}>{selectedSong.artist}</Text>
              </View>
            )}
            
            <Text style={styles.inputLabel}>Target Organization *</Text>
            <View style={styles.organizationSelector}>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.orgOption,
                    selectedTargetOrg === org.id && styles.orgOptionSelected
                  ]}
                  onPress={() => setSelectedTargetOrg(org.id)}
                >
                  <Text style={[
                    styles.orgOptionText,
                    selectedTargetOrg === org.id && styles.orgOptionTextSelected
                  ]}>
                    {org.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.inputLabel}>Access Level</Text>
            <View style={styles.accessLevelSelector}>
              {(['public', 'private', 'restricted'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.accessOption,
                    selectedAccessLevel === level && styles.accessOptionSelected
                  ]}
                  onPress={() => setSelectedAccessLevel(level)}
                >
                  <Text style={[
                    styles.accessOptionText,
                    selectedAccessLevel === level && styles.accessOptionTextSelected
                  ]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.accessDescription}>
              {selectedAccessLevel === 'public' && 'All users in the organization can access this song'}
              {selectedAccessLevel === 'private' && 'Only specific users in the organization can access this song'}
              {selectedAccessLevel === 'restricted' && 'Limited access based on user permissions'}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#BBBBBB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#BBBBBB',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  songCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  songArtist: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 2,
  },
  songMeta: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 4,
  },
  assignmentCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentSong: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  assignmentOrg: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 2,
  },
  assignmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  assignmentDate: {
    fontSize: 12,
    color: '#AAAAAA',
    marginLeft: 8,
  },
  accessLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  accessLevelText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#BBBBBB',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#AAAAAA',
    marginTop: 4,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalSave: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  selectedSongInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedSongTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedSongArtist: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  organizationSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  orgOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  orgOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  orgOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  orgOptionTextSelected: {
    color: '#fff',
  },
  accessLevelSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  accessOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  accessOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  accessOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  accessOptionTextSelected: {
    color: '#fff',
  },
  accessDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    fontStyle: 'italic',
  },
});

export default SongAssignmentScreen;
