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
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [showGroupMenu, setShowGroupMenu] = useState<string | null>(null);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<UserGroup | null>(null);
  const [showUserGroupsModal, setShowUserGroupsModal] = useState(false);
  const [selectedUserForGroups, setSelectedUserForGroups] = useState<AdminUserView | null>(null);
  
  // Assignment management state
  const [assignments, setAssignments] = useState<Array<{
    userId: string;
    userName: string;
    userEmail: string;
    groupId: string;
    groupName: string;
    groupColor: string;
    addedBy: string;
    addedAt: string;
    isActive: boolean;
  }>>([]);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const [bulkAssignmentAction, setBulkAssignmentAction] = useState<'add' | 'remove'>('add');
  const [bulkAssignmentGroups, setBulkAssignmentGroups] = useState<string[]>([]);

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
      console.log('Loading data...');
      
      const [groupsData, usersData] = await Promise.all([
        groupService.getAllGroups(),
        groupService.getAllUsersForAdmin()
      ]);
      
      // Ensure we have arrays even if the service returns undefined
      const safeGroupsData = Array.isArray(groupsData) ? groupsData : [];
      const safeUsersData = Array.isArray(usersData) ? usersData : [];
      
      console.log('Groups loaded:', safeGroupsData.length);
      console.log('Users loaded:', safeUsersData.length);
      
      setGroups(safeGroupsData);
      setUsers(safeUsersData);
      loadAssignments(safeGroupsData, safeUsersData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = (groupsData: UserGroup[], usersData: AdminUserView[]) => {
    console.log('Loading assignments...');
    console.log('Groups data:', groupsData.map(g => ({ id: g.id, name: g.name, members: g.members || [] })));
    console.log('Users data:', usersData.map(u => ({ id: u.id, name: u.displayName, email: u.email })));
    
    const assignmentList: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      groupId: string;
      groupName: string;
      groupColor: string;
      addedBy: string;
      addedAt: string;
      isActive: boolean;
    }> = [];

    // Create assignments from group memberships
    groupsData.forEach(group => {
      const members = group.members || [];
      console.log(`Processing group ${group.name} with ${members.length} members:`, members);
      members.forEach(userId => {
        const user = usersData.find(u => u.id === userId);
        console.log(`Looking for user ${userId}, found:`, user ? user.displayName : 'NOT FOUND');
        if (user) {
          assignmentList.push({
            userId: user.id,
            userName: user.displayName || user.email,
            userEmail: user.email,
            groupId: group.id,
            groupName: group.name,
            groupColor: group.color || '#BB86FC',
            addedBy: 'Unknown', // This would need to be tracked in the actual implementation
            addedAt: user.joinDate?.toISOString() || new Date().toISOString(),
            isActive: true
          });
        }
      });
    });

    console.log('Created assignments:', assignmentList.length);
    setAssignments(assignmentList);
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

  const handleEditGroup = (group: UserGroup) => {
    setEditingGroup(group);
    setShowEditGroupModal(true);
    setShowGroupMenu(null);
  };

  const handleUpdateGroup = async (groupData: GroupFormData) => {
    if (!editingGroup) return;

    try {
      await groupService.updateGroup(editingGroup.id, {
        name: groupData.name,
        description: groupData.description,
        color: groupData.color,
        icon: groupData.icon
      });
      setShowEditGroupModal(false);
      setEditingGroup(null);
      Alert.alert('Success', 'Group updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update group');
    }
  };

  const handleManageMembers = (group: UserGroup) => {
    setSelectedGroupForMembers(group);
    setShowGroupMembersModal(true);
    setShowGroupMenu(null);
  };

  const handleRemoveUserFromGroup = async (userId: string, groupId: string) => {
    Alert.alert(
      'Remove User',
      'Are you sure you want to remove this user from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await groupService.assignUsersToGroups({
                userIds: [userId],
                groupIds: [groupId],
                action: 'remove'
              }, currentUserId);
              Alert.alert('Success', 'User removed from group successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove user from group');
            }
          }
        }
      ]
    );
  };

  const handleManageUserGroups = (user: AdminUserView) => {
    setSelectedUserForGroups(user);
    setShowUserGroupsModal(true);
  };

  const handleUpdateUserGroups = async (user: AdminUserView, selectedGroupIds: string[]) => {
    try {
      const currentGroupIds = user.groupMemberships || [];
      
      // Find groups to add and remove
      const groupsToAdd = selectedGroupIds.filter(groupId => !currentGroupIds.includes(groupId));
      const groupsToRemove = currentGroupIds.filter(groupId => !selectedGroupIds.includes(groupId));

      // Add user to new groups
      if (groupsToAdd.length > 0) {
        await groupService.assignUsersToGroups({
          userIds: [user.id],
          groupIds: groupsToAdd,
          action: 'add'
        }, currentUserId);
      }

      // Remove user from old groups
      if (groupsToRemove.length > 0) {
        await groupService.assignUsersToGroups({
          userIds: [user.id],
          groupIds: groupsToRemove,
          action: 'remove'
        }, currentUserId);
      }

      setShowUserGroupsModal(false);
      setSelectedUserForGroups(null);
      Alert.alert('Success', 'User group memberships updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update user group memberships');
    }
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
      
      // Reload assignments after successful assignment
      loadAssignments(groups, users);
    } catch (error) {
      Alert.alert('Error', 'Failed to assign users');
    }
  };

  // Assignment management functions
  const handleAssignmentToggle = (assignmentId: string) => {
    if (selectedAssignments.includes(assignmentId)) {
      setSelectedAssignments(selectedAssignments.filter(id => id !== assignmentId));
    } else {
      setSelectedAssignments([...selectedAssignments, assignmentId]);
    }
  };

  const handleBulkAssignment = async () => {
    if (selectedAssignments.length === 0 || bulkAssignmentGroups.length === 0) {
      Alert.alert('Error', 'Please select assignments and groups');
      return;
    }

    try {
      const userIds = selectedAssignments.map(assignmentId => {
        const assignment = assignments.find(a => `${a.userId}-${a.groupId}` === assignmentId);
        return assignment?.userId;
      }).filter(Boolean) as string[];

      await groupService.assignUsersToGroups({
        userIds,
        groupIds: bulkAssignmentGroups,
        action: bulkAssignmentAction
      }, currentUserId);

      setSelectedAssignments([]);
      setBulkAssignmentGroups([]);
      setShowBulkAssignmentModal(false);
      Alert.alert('Success', `Users ${bulkAssignmentAction === 'add' ? 'assigned to' : 'removed from'} groups successfully`);
      
      // Reload assignments
      loadAssignments(groups, users);
    } catch (error) {
      Alert.alert('Error', `Failed to ${bulkAssignmentAction} users`);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const assignment = assignments.find(a => `${a.userId}-${a.groupId}` === assignmentId);
    if (!assignment) return;

    try {
      await groupService.assignUsersToGroups({
        userIds: [assignment.userId],
        groupIds: [assignment.groupId],
        action: 'remove'
      }, currentUserId);

      Alert.alert('Success', 'Assignment removed successfully');
      loadAssignments(groups, users);
    } catch (error) {
      Alert.alert('Error', 'Failed to remove assignment');
    }
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.userName.toLowerCase().includes(assignmentSearchQuery.toLowerCase()) ||
    assignment.userEmail.toLowerCase().includes(assignmentSearchQuery.toLowerCase()) ||
    assignment.groupName.toLowerCase().includes(assignmentSearchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    (user.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderGroupItem = ({ item }: { item: UserGroup }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => setShowGroupMenu(null)}
      activeOpacity={1}
    >
      <View style={styles.groupInfo}>
        <View style={styles.groupDetails}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupDescription}>{item.description}</Text>
          <Text style={styles.memberCount}>{item.members?.length || 0} members</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setShowGroupMenu(showGroupMenu === item.id ? null : item.id)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#BBBBBB" />
      </TouchableOpacity>
      {showGroupMenu === item.id && (
        <View style={styles.groupMenu}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleEditGroup(item)}
          >
            <Text style={styles.menuItemText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleManageMembers(item)}
          >
            <Text style={styles.menuItemText}>Manage Members</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setShowGroupMenu(null);
              handleDeleteGroup(item.id);
            }}
          >
            <Text style={[styles.menuItemText, styles.deleteMenuItemText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }: { item: AdminUserView }) => (
    <View style={styles.userItem}>
      <TouchableOpacity
        style={[
          styles.userInfo,
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
      </TouchableOpacity>
      <View style={styles.userActions}>
        {selectedUsers.includes(item.id) && (
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        )}
        <TouchableOpacity
          style={styles.manageGroupsButton}
          onPress={() => handleManageUserGroups(item)}
        >
          <Ionicons name="settings-outline" size={20} color="#BB86FC" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAssignmentItem = ({ item }: { item: typeof assignments[0] }) => {
    const assignmentId = `${item.userId}-${item.groupId}`;
    const isSelected = selectedAssignments.includes(assignmentId);
    
    return (
      <TouchableOpacity
        style={[styles.assignmentItem, isSelected && styles.selectedAssignmentItem]}
        onPress={() => handleAssignmentToggle(assignmentId)}
      >
        <View style={styles.assignmentCheckbox}>
          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />}
        </View>
        
        <View style={styles.assignmentInfo}>
          <View style={styles.assignmentUser}>
            <View style={styles.assignmentUserAvatar}>
              <Text style={styles.assignmentUserAvatarText}>
                {item.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.assignmentUserDetails}>
              <Text style={styles.assignmentUserName}>{item.userName}</Text>
              <Text style={styles.assignmentUserEmail}>{item.userEmail}</Text>
            </View>
          </View>
          
          <View style={styles.assignmentGroup}>
            <View style={[styles.assignmentGroupColor, { backgroundColor: item.groupColor }]} />
            <Text style={styles.assignmentGroupName}>{item.groupName}</Text>
          </View>
          
          <View style={styles.assignmentMeta}>
            <Text style={styles.assignmentDate}>
              Added: {new Date(item.addedAt).toLocaleDateString()}
            </Text>
            <Text style={styles.assignmentStatus}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.assignmentRemoveButton}
          onPress={() => handleRemoveAssignment(assignmentId)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF5722" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search assignments..."
              value={assignmentSearchQuery}
              onChangeText={setAssignmentSearchQuery}
            />
          </View>

          {selectedAssignments.length > 0 && (
            <View style={styles.bulkActionsContainer}>
              <Text style={styles.bulkActionsText}>
                {selectedAssignments.length} assignment{selectedAssignments.length > 1 ? 's' : ''} selected
              </Text>
              <View style={styles.bulkActionsButtons}>
                <TouchableOpacity
                  style={[styles.bulkActionButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => {
                    setBulkAssignmentAction('add');
                    setShowBulkAssignmentModal(true);
                  }}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.bulkActionButtonText}>Add to Groups</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkActionButton, { backgroundColor: '#FF5722' }]}
                  onPress={() => {
                    setBulkAssignmentAction('remove');
                    setShowBulkAssignmentModal(true);
                  }}
                >
                  <Ionicons name="remove" size={16} color="#FFFFFF" />
                  <Text style={styles.bulkActionButtonText}>Remove from Groups</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FlatList
            data={filteredAssignments}
            keyExtractor={(item) => `${item.userId}-${item.groupId}`}
            renderItem={renderAssignmentItem}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>No assignments found</Text>
                <Text style={styles.emptySubtext}>
                  {assignmentSearchQuery ? 'Try adjusting your search' : 'Create some user-group assignments'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        visible={showEditGroupModal}
        onClose={() => {
          setShowEditGroupModal(false);
          setEditingGroup(null);
        }}
        onUpdateGroup={handleUpdateGroup}
        group={editingGroup}
      />

      {/* Group Members Modal */}
      <GroupMembersModal
        visible={showGroupMembersModal}
        onClose={() => {
          setShowGroupMembersModal(false);
          setSelectedGroupForMembers(null);
        }}
        group={selectedGroupForMembers}
        users={users}
        onRemoveUser={handleRemoveUserFromGroup}
      />

      {/* User Groups Modal */}
      <UserGroupsModal
        visible={showUserGroupsModal}
        onClose={() => {
          setShowUserGroupsModal(false);
          setSelectedUserForGroups(null);
        }}
        user={selectedUserForGroups}
        groups={groups}
        onUpdateUserGroups={handleUpdateUserGroups}
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

      {/* Bulk Assignment Modal */}
      <BulkAssignmentModal
        visible={showBulkAssignmentModal}
        onClose={() => {
          setShowBulkAssignmentModal(false);
          setBulkAssignmentGroups([]);
        }}
        groups={groups}
        selectedAssignments={selectedAssignments}
        assignments={assignments}
        selectedGroups={bulkAssignmentGroups}
        onSelectGroups={setBulkAssignmentGroups}
        onBulkAssign={handleBulkAssignment}
        action={bulkAssignmentAction}
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

// Edit Group Modal Component
const EditGroupModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onUpdateGroup: (data: GroupFormData) => void;
  group: UserGroup | null;
}> = ({ visible, onClose, onUpdateGroup, group }) => {
  const [formData, setFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    color: '#BB86FC',
    icon: 'people'
  });

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name || '',
        description: group.description || '',
        color: group.color || '#BB86FC',
        icon: group.icon || 'people'
      });
    }
  }, [group]);

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    onUpdateGroup(formData);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Group</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter group name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Enter group description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Color</Text>
            <View style={styles.colorOptions}>
              {['#BB86FC', '#03DAC6', '#FF6B6B', '#4CAF50', '#FF9800', '#2196F3'].map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    formData.color === color && styles.selectedColorOption
                  ]}
                  onPress={() => setFormData({ ...formData, color })}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconOptions}>
              {['people', 'musical-notes', 'star', 'heart', 'book', 'home'].map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    formData.icon === icon && styles.selectedIconOption
                  ]}
                  onPress={() => setFormData({ ...formData, icon })}
                >
                  <Ionicons
                    name={icon as any}
                    size={24}
                    color={formData.icon === icon ? '#FFFFFF' : '#BBBBBB'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Update Group</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// Group Members Modal Component
const GroupMembersModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  group: UserGroup | null;
  users: AdminUserView[];
  onRemoveUser: (userId: string, groupId: string) => void;
}> = ({ visible, onClose, group, users, onRemoveUser }) => {
  if (!group) return null;

  // Get the actual user objects for the group members
  const groupMembers = users.filter(user => 
    group.members?.includes(user.id)
  );

  const renderMemberItem = ({ item }: { item: AdminUserView }) => (
    <View style={styles.memberItem}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {(item.displayName || item.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{item.displayName || 'No Name'}</Text>
          <Text style={styles.memberEmail}>{item.email || 'No Email'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeMemberButton}
        onPress={() => onRemoveUser(item.id, group.id)}
      >
        <Ionicons name="close-circle" size={24} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {group.name} - Members ({groupMembers.length})
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {groupMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#666" />
              <Text style={styles.emptyStateText}>No members in this group</Text>
            </View>
          ) : (
            <FlatList
              data={groupMembers}
              keyExtractor={(item) => item.id}
              renderItem={renderMemberItem}
              style={styles.membersList}
            />
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// User Groups Modal Component
const UserGroupsModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  user: AdminUserView | null;
  groups: UserGroup[];
  onUpdateUserGroups: (user: AdminUserView, selectedGroupIds: string[]) => void;
}> = ({ visible, onClose, user, groups, onUpdateUserGroups }) => {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setSelectedGroupIds(user.groupMemberships || []);
    }
  }, [user]);

  if (!user) return null;

  const handleGroupToggle = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter(id => id !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  };

  const handleSave = () => {
    onUpdateUserGroups(user, selectedGroupIds);
  };

  const renderGroupItem = ({ item }: { item: UserGroup }) => (
    <TouchableOpacity
      style={[
        styles.groupSelectItem,
        selectedGroupIds.includes(item.id) && styles.selectedGroupItem
      ]}
      onPress={() => handleGroupToggle(item.id)}
    >
      <View style={[styles.groupColor, { backgroundColor: item.color || '#BB86FC' }]} />
      <Text style={styles.groupSelectName}>{item.name}</Text>
      {selectedGroupIds.includes(item.id) && (
        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Manage Groups - {user.displayName || user.email || 'User'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.sectionDescription}>
            Select the groups this user should belong to:
          </Text>
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            renderItem={renderGroupItem}
            style={styles.groupsList}
          />
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSave}
          >
            <Text style={styles.submitButtonText}>Save Changes</Text>
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

// Bulk Assignment Modal Component
const BulkAssignmentModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  groups: UserGroup[];
  selectedAssignments: string[];
  assignments: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    groupId: string;
    groupName: string;
    groupColor: string;
    addedBy: string;
    addedAt: string;
    isActive: boolean;
  }>;
  selectedGroups: string[];
  onSelectGroups: (groups: string[]) => void;
  onBulkAssign: () => void;
  action: 'add' | 'remove';
}> = ({ visible, onClose, groups, selectedAssignments, assignments, selectedGroups, onSelectGroups, onBulkAssign, action }) => {
  const handleGroupToggle = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      onSelectGroups(selectedGroups.filter(id => id !== groupId));
    } else {
      onSelectGroups([...selectedGroups, groupId]);
    }
  };

  const selectedUserIds = selectedAssignments.map(assignmentId => {
    const assignment = assignments.find(a => `${a.userId}-${a.groupId}` === assignmentId);
    return assignment?.userId;
  }).filter(Boolean) as string[];

  const uniqueUsers = selectedUserIds.map(userId => {
    const assignment = assignments.find(a => a.userId === userId);
    return assignment ? { id: userId, name: assignment.userName, email: assignment.userEmail } : null;
  }).filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {action === 'add' ? 'Add' : 'Remove'} {uniqueUsers.length} users {action === 'add' ? 'to' : 'from'} groups
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.selectedUsersContainer}>
            <Text style={styles.selectedUsersTitle}>Selected Users:</Text>
            {uniqueUsers.map((user, index) => (
              <View key={user?.id || index} style={styles.selectedUserItemModal}>
                <View style={styles.selectedUserAvatar}>
                  <Text style={styles.selectedUserAvatarText}>
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={styles.selectedUserDetails}>
                  <Text style={styles.selectedUserName}>{user?.name}</Text>
                  <Text style={styles.selectedUserEmail}>{user?.email}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.groupsTitle}>Select Groups:</Text>
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
            onPress={onBulkAssign}
            disabled={selectedGroups.length === 0}
          >
            <Text style={styles.submitButtonText}>
              {action === 'add' ? 'Add to Groups' : 'Remove from Groups'}
            </Text>
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
    overflow: 'visible',
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
    overflow: 'visible',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'visible',
    zIndex: 1,
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
  menuButton: {
    padding: 8,
    marginLeft: 8,
  },
  groupMenu: {
    position: 'absolute',
    right: 8,
    bottom: 50,
    backgroundColor: '#2E2E2E',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 9999,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  deleteMenuItemText: {
    color: '#FF6B6B',
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
  groupColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#FFFFFF',
  },
  iconOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2E2E2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedIconOption: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#BB86FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memberEmail: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  removeMemberButton: {
    padding: 8,
  },
  membersList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageGroupsButton: {
    padding: 8,
  },
  groupsList: {
    flex: 1,
  },
  sectionDescription: {
    color: '#BBBBBB',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  // Assignment styles
  assignmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedAssignmentItem: {
    borderColor: '#BB86FC',
    backgroundColor: '#2A1E2E',
  },
  assignmentCheckbox: {
    width: 24,
    height: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignmentUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#BB86FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assignmentUserAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  assignmentUserDetails: {
    flex: 1,
  },
  assignmentUserName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  assignmentUserEmail: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  assignmentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  assignmentGroupColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  assignmentGroupName: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: '500',
  },
  assignmentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  assignmentDate: {
    color: '#888',
    fontSize: 12,
  },
  assignmentStatus: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  assignmentRemoveButton: {
    padding: 8,
    marginLeft: 8,
  },
  bulkActionsContainer: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  bulkActionsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  bulkActionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bulkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  bulkActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#BBBBBB',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  selectedUsersContainer: {
    marginBottom: 24,
  },
  selectedUsersTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  selectedUserItemModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedUserAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#BB86FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedUserAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedUserDetails: {
    flex: 1,
  },
  selectedUserName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedUserEmail: {
    color: '#BBBBBB',
    fontSize: 12,
  },
  groupsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});

export default GroupManagement;
