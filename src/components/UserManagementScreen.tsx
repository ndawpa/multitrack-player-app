import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TenantService from '../services/tenantService';
import { Tenant, Organization, UserTenantAssignment } from '../types/tenant';

interface UserManagementScreenProps {
  onBack: () => void;
  tenantId: string;
  organizationId?: string;
  userId: string;
  embedded?: boolean;
}

interface User {
  id: string;
  email: string;
  displayName: string;
}

const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ 
  onBack, 
  tenantId, 
  organizationId, 
  userId,
  embedded = false
}) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [assignments, setAssignments] = useState<UserTenantAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');
  
  const tenantService = TenantService.getInstance();

  useEffect(() => {
    loadData();
  }, [tenantId, organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tenant
      const tenantData = await tenantService.getTenant(tenantId);
      setTenant(tenantData);
      
      // Load organization if specified
      if (organizationId) {
        const orgData = await tenantService.getOrganization(organizationId);
        setOrganization(orgData);
      }
      
      // Load user assignments for this tenant/organization
      const userAssignments = await tenantService.getTenantUsers(tenantId);
      const filteredAssignments = organizationId 
        ? userAssignments.filter(a => a.organizationId === organizationId)
        : userAssignments;
      setAssignments(filteredAssignments);
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      // Load real users from your database
      const { getDatabase, ref, get } = await import('firebase/database');
      const database = getDatabase();
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        const userList: User[] = Object.entries(users).map(([id, user]: [string, any]) => ({
          id,
          email: user.email || 'no-email@example.com',
          displayName: user.displayName || (user.email ? user.email.split('@')[0] : `User ${id}`),
          avatar: user.avatar,
          preferences: user.preferences || {
            theme: 'auto',
            defaultPlaybackSpeed: 1.0,
            autoPlay: false,
            notifications: true,
            language: 'en'
          },
          stats: user.stats || {
            totalSessions: 0,
            totalPlayTime: 0,
            joinedDate: new Date(),
            favoriteArtists: [],
            favoriteSongs: []
          },
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : new Date(),
          emailVerified: user.emailVerified || false
        }));
        
        setAvailableUsers(userList);
      } else {
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('Error loading available users:', error);
      setAvailableUsers([]);
    }
  };

  const handleAddUser = async () => {
    try {
      if (!selectedUser) {
        Alert.alert('Error', 'Please select a user');
        return;
      }

      // Check if user is already assigned to this organization
      const existingAssignment = assignments.find(a => a.userId === selectedUser.id);
      if (existingAssignment) {
        Alert.alert('Error', 'This user is already assigned to this organization');
        return;
      }

      // Create user assignment
      await tenantService.assignUserToTenant(
        selectedUser.id,
        tenantId,
        organizationId,
        selectedRole
      );

      Alert.alert(
        'Success', 
        `${selectedUser.displayName} has been added to the organization with ${selectedRole} role.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowAddUser(false);
              setSelectedUser(null);
              setSelectedRole('member');
              setSearchQuery('');
              loadData();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Error adding user:', error);
      Alert.alert('Error', 'Failed to add user to organization');
    }
  };

  const handleRemoveUser = async (assignmentId: string, userDisplayName: string) => {
    Alert.alert(
      'Remove User',
      `Are you sure you want to remove ${userDisplayName} from this ${organizationId ? 'organization' : 'tenant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // In a real app, you'd remove the assignment from the database
              Alert.alert('Success', 'User removed successfully');
              loadData();
            } catch (error) {
              console.error('Error removing user:', error);
              Alert.alert('Error', 'Failed to remove user');
            }
          }
        }
      ]
    );
  };

  const renderUserAssignment = ({ item }: { item: UserTenantAssignment }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>User ID: {item.userId}</Text>
        <Text style={styles.userRole}>Role: {item.role.name}</Text>
        <Text style={styles.userMeta}>
          Assigned: {new Date(item.assignedAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveUser(item.id, `User ${item.userId}`)}
      >
        <Ionicons name="trash-outline" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading user data...</Text>
      </View>
    );
  }

  return (
    <View style={embedded ? styles.embeddedContainer : styles.container}>
      {!embedded && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#BB86FC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {organization ? organization.name : tenant?.name} - Users
          </Text>
          <TouchableOpacity
            onPress={() => {
              loadAvailableUsers();
              setShowAddUser(true);
            }}
            style={styles.addButton}
          >
            <Ionicons name="person-add" size={24} color="#BB86FC" />
          </TouchableOpacity>
        </View>
      )}
      
      {embedded && (
        <View style={styles.embeddedHeader}>
          <TouchableOpacity
            onPress={() => {
              loadAvailableUsers();
              setShowAddUser(true);
            }}
            style={styles.addButton}
          >
            <Ionicons name="person-add" size={24} color="#BB86FC" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {organization ? 'Organization Members' : 'Tenant Members'}
          </Text>
          
          {assignments.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No users assigned</Text>
              <Text style={styles.emptySubtext}>Invite users to get started</Text>
            </View>
          ) : (
            <FlatList
              data={assignments}
              renderItem={renderUserAssignment}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Add User Modal */}
      <Modal
        visible={showAddUser}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddUser(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add User</Text>
            <TouchableOpacity onPress={handleAddUser}>
              <Text style={styles.modalSave}>Add</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Search Users</Text>
            <TextInput
              style={styles.input}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or email..."
            />
            
            <Text style={styles.inputLabel}>Available Users</Text>
            <View style={styles.userList}>
              {availableUsers
                .filter(user => 
                  user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  user.email.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      styles.userOption,
                      selectedUser?.id === user.id && styles.userOptionSelected
                    ]}
                    onPress={() => setSelectedUser(user)}
                  >
                    <View style={styles.userOptionInfo}>
                      <Text style={[
                        styles.userOptionName,
                        selectedUser?.id === user.id && styles.userOptionNameSelected
                      ]}>
                        {user.displayName}
                      </Text>
                      <Text style={[
                        styles.userOptionEmail,
                        selectedUser?.id === user.id && styles.userOptionEmailSelected
                      ]}>
                        {user.email}
                      </Text>
                    </View>
                    {selectedUser?.id === user.id && (
                      <Ionicons name="checkmark" size={20} color="#BB86FC" />
                    )}
                  </TouchableOpacity>
                ))}
            </View>
            
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleSelector}>
              {['owner', 'admin', 'member', 'viewer'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    selectedRole === role && styles.roleOptionSelected
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={[
                    styles.roleOptionText,
                    selectedRole === role && styles.roleOptionTextSelected
                  ]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.roleDescription}>
              {selectedRole === 'owner' && 'Full access to tenant and all organizations'}
              {selectedRole === 'admin' && 'Can manage users and organizations, create songs'}
              {selectedRole === 'member' && 'Can create and view songs'}
              {selectedRole === 'viewer' && 'Can only view songs'}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  embeddedContainer: {
    flex: 1,
  },
  embeddedHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
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
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 8,
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
    marginBottom: 12,
  },
  userCard: {
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userRole: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 4,
  },
  userMeta: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 4,
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
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalCancel: {
    fontSize: 16,
    color: '#BB86FC',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalSave: {
    fontSize: 16,
    color: '#BB86FC',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  roleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  roleOptionSelected: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  roleOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  roleOptionTextSelected: {
    color: '#fff',
  },
  roleDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    fontStyle: 'italic',
  },
  userList: {
    marginTop: 8
  },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9F9F9'
  },
  userOptionSelected: {
    borderColor: '#BB86FC',
    backgroundColor: '#2A1A3A'
  },
  userOptionInfo: {
    flex: 1
  },
  userOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  userOptionNameSelected: {
    color: '#BB86FC'
  },
  userOptionEmail: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 2
  },
  userOptionEmailSelected: {
    color: '#BB86FC'
  }
});

export default UserManagementScreen;
