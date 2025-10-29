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
import { UserGroup, AdminUserView, GroupFormData } from '../types/group';

interface GroupManagementProps {
  onClose: () => void;
  currentUserId?: string;
}

const GroupManagement: React.FC<GroupManagementProps> = ({ onClose, currentUserId = 'admin' }) => {
  const [activeTab, setActiveTab] = useState<'groups' | 'users' | 'assignments'>('groups');
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const groupService = GroupService.getInstance();

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
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

  const handleCreateGroup = async (groupData: GroupFormData) => {
    try {
      await groupService.createGroup(groupData, currentUserId);
      setShowCreateGroupModal(false);
      Alert.alert('Success', 'Group created successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.deleteGroup(groupId);
              Alert.alert('Success', 'Group deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const handleAssignUsers = async () => {
    if (selectedUsers.length === 0 || selectedGroups.length === 0) {
      Alert.alert('Error', 'Please select users and groups');
      return;
    }

    try {
      await groupService.assignUsersToGroups({
        userIds: selectedUsers,
        groupIds: selectedGroups,
        action: 'add'
      }, currentUserId);
      
      setSelectedUsers([]);
      setSelectedGroups([]);
      setShowAssignmentModal(false);
      Alert.alert('Success', 'Users assigned to groups successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to assign users');
    }
  };

  const filteredUsers = users.filter(user =>
    (user.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderGroupItem = ({ item }: { item: UserGroup }) => (
    <View style={styles.groupItem}>
      <View style={styles.groupInfo}>
        <View style={styles.groupDetails}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
          <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteGroup(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  const renderUserItem = ({ item }: { item: AdminUserView }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        selectedUsers.includes(item.id) && styles.selectedUserItem
      ]}
      onPress={() => {
        if (selectedUsers.includes(item.id)) {
          setSelectedUsers(selectedUsers.filter(id => id !== item.id));
        } else {
          setSelectedUsers([...selectedUsers, item.id]);
        }
      }}
    >
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>
            {(item.displayName || item.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.displayName || 'No Name'}</Text>
          <Text style={styles.userEmail}>{item.email || 'No Email'}</Text>
          <Text style={styles.userGroups}>
            Groups: {item.groupMemberships?.length || 0}
          </Text>
        </View>
      </View>
      {selectedUsers.includes(item.id) && (
        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.header}>
          <Text style={styles.headerTitle}>Group Management</Text>
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
        <Text style={styles.headerTitle}>Group Management</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups ({groups.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.activeTab]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assignments' && styles.activeTab]}
          onPress={() => setActiveTab('assignments')}
        >
          <Text style={[styles.tabText, activeTab === 'assignments' && styles.activeTabText]}>
            Assignments
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'groups' && (
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateGroupModal(true)}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>

          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            style={styles.list}
          />
        </View>
      )}

      {activeTab === 'users' && (
        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            style={styles.list}
          />

          {selectedUsers.length > 0 && (
            <TouchableOpacity
              style={styles.assignButton}
              onPress={() => setShowAssignmentModal(true)}
            >
              <Text style={styles.assignButtonText}>
                Assign {selectedUsers.length} users to groups
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'assignments' && (
        <View style={styles.content}>
          <Text style={styles.placeholderText}>
            Assignment management coming soon...
          </Text>
        </View>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
      />

      {/* Assignment Modal */}
      <AssignmentModal
        visible={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        groups={groups}
        selectedUsers={selectedUsers}
        selectedGroups={selectedGroups}
        onSelectGroups={setSelectedGroups}
        onAssign={handleAssignUsers}
      />
    </View>
  );
};

// Create Group Modal Component
const CreateGroupModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCreateGroup: (data: GroupFormData) => void;
}> = ({ visible, onClose, onCreateGroup }) => {
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    color: '#BB86FC',
    icon: 'people'
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    onCreateGroup(formData);
    setFormData({ name: '', description: '', color: '#BB86FC', icon: 'people' });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Create Group</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Group Name"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={styles.input}
            placeholder="Color (hex code)"
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
          />
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Assignment Modal Component
const AssignmentModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  groups: UserGroup[];
  selectedUsers: string[];
  selectedGroups: string[];
  onSelectGroups: (groups: string[]) => void;
  onAssign: () => void;
}> = ({ visible, onClose, groups, selectedUsers, selectedGroups, onSelectGroups, onAssign }) => {
  const handleGroupToggle = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onSelectGroups(selectedGroups.filter(id => id !== groupId));
    } else {
      onSelectGroups([...selectedGroups, groupId]);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Assign {selectedUsers.length} users to groups
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.groupSelectItem,
                selectedGroups.includes(group.id) && styles.selectedGroupItem
              ]}
              onPress={() => handleGroupToggle(group.id)}
            >
              <View style={[styles.groupColor, { backgroundColor: group.color || '#BB86FC' }]} />
              <Text style={styles.groupSelectName}>{group.name}</Text>
              {selectedGroups.includes(group.id) && (
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.submitButton, selectedGroups.length === 0 && styles.disabledButton]} 
            onPress={onAssign}
            disabled={selectedGroups.length === 0}
          >
            <Text style={styles.submitButtonText}>Assign Users</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BB86FC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  list: {
    flex: 1,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  memberCount: {
    color: '#BB86FC',
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
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
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedUserItem: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BB86FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  userGroups: {
    color: '#BB86FC',
    fontSize: 12,
    marginTop: 2,
  },
  assignButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  placeholderText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
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
  input: {
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  disabledButton: {
    backgroundColor: '#666',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    marginLeft: 12,
  },
});

export default GroupManagement;
