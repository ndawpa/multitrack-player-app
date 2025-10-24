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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TenantService from '../services/tenantService';
import UserManagementScreen from './UserManagementScreen';
import SongAssignmentScreen from './SongAssignmentScreen';
import { Tenant, Organization, CreateTenantForm, CreateOrganizationForm } from '../types/tenant';

interface TenantManagementScreenProps {
  onBack: () => void;
  userId: string;
}

const TenantManagementScreen: React.FC<TenantManagementScreenProps> = ({ onBack, userId }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreateOrganization, setShowCreateOrganization] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showSongAssignment, setShowSongAssignment] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  
  // Form states
  const [tenantForm, setTenantForm] = useState<CreateTenantForm>({
    name: '',
    description: '',
    domain: '',
    settings: {}
  });
  
  const [orgForm, setOrgForm] = useState<CreateOrganizationForm>({
    tenantId: '',
    name: '',
    description: '',
    parentId: undefined,
    settings: {}
  });

  const tenantService = TenantService.getInstance();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load user's tenant assignments
      const assignments = await tenantService.getUserTenantAssignments(userId);
      
      // Load tenants and organizations
      const tenantPromises = assignments.map(assignment => 
        tenantService.getTenant(assignment.tenantId)
      );
      const tenantResults = await Promise.all(tenantPromises);
      const validTenants = tenantResults.filter(tenant => tenant !== null) as Tenant[];
      
      // Remove duplicate tenants (same tenant can have multiple assignments)
      const uniqueTenants = validTenants.filter((tenant, index, self) => 
        index === self.findIndex(t => t.id === tenant.id)
      );
      
      setTenants(uniqueTenants);
      
      if (uniqueTenants.length > 0) {
        const orgPromises = uniqueTenants.map(tenant => 
          tenantService.getOrganizationsByTenant(tenant.id)
        );
        const orgResults = await Promise.all(orgPromises);
        const allOrgs = orgResults.flat();
        setOrganizations(allOrgs);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    try {
      if (!tenantForm.name.trim()) {
        Alert.alert('Error', 'Please enter a tenant name');
        return;
      }

      await tenantService.createTenant(tenantForm, userId);
      setShowCreateTenant(false);
      setTenantForm({ name: '', description: '', domain: '', settings: {} });
      loadData();
      Alert.alert('Success', 'Tenant created successfully');
    } catch (error) {
      console.error('Error creating tenant:', error);
      Alert.alert('Error', 'Failed to create tenant');
    }
  };

  const handleCreateOrganization = async () => {
    try {
      if (!orgForm.name.trim() || !orgForm.tenantId) {
        Alert.alert('Error', 'Please enter organization name and select a tenant');
        return;
      }

      await tenantService.createOrganization(orgForm, userId);
      setShowCreateOrganization(false);
      setOrgForm({ tenantId: '', name: '', description: '', parentId: undefined, settings: {} });
      loadData();
      Alert.alert('Success', 'Organization created successfully');
    } catch (error) {
      console.error('Error creating organization:', error);
      Alert.alert('Error', 'Failed to create organization');
    }
  };

  const renderTenant = ({ item }: { item: Tenant }) => (
    <TouchableOpacity
      style={styles.tenantCard}
      onPress={() => setSelectedTenant(item)}
    >
      <View style={styles.tenantHeader}>
        <Text style={styles.tenantName}>{item.name}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      {item.description && (
        <Text style={styles.tenantDescription}>{item.description}</Text>
      )}
      <Text style={styles.tenantMeta}>
        Created: {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderOrganization = ({ item }: { item: Organization }) => (
    <View style={styles.orgCard}>
      <TouchableOpacity
        style={styles.orgInfo}
        onPress={() => {
          setSelectedOrganization(item);
          setShowUserManagement(true);
        }}
      >
        <View style={styles.orgInfoContent}>
          <Text style={styles.orgName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.orgDescription}>{item.description}</Text>
          )}
          <Text style={styles.orgMeta}>
            Created: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Ionicons name="people" size={20} color="#666" />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.songAssignmentButton}
        onPress={() => {
          setSelectedOrganization(item);
          setShowSongAssignment(true);
        }}
      >
        <Ionicons name="musical-notes" size={20} color="#007AFF" />
        <Text style={styles.songAssignmentText}>Songs</Text>
      </TouchableOpacity>
    </View>
  );

  if (showUserManagement && selectedTenant) {
    return (
      <UserManagementScreen
        onBack={() => {
          setShowUserManagement(false);
          setSelectedOrganization(null);
        }}
        tenantId={selectedTenant.id}
        organizationId={selectedOrganization?.id}
        userId={userId}
      />
    );
  }

  if (showSongAssignment && selectedTenant) {
    return (
      <SongAssignmentScreen
        onBack={() => {
          setShowSongAssignment(false);
          setSelectedOrganization(null);
        }}
        tenantId={selectedTenant.id}
        organizationId={selectedOrganization?.id}
        userId={userId}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tenant data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Management</Text>
        <TouchableOpacity
          onPress={() => setShowCreateTenant(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Tenants</Text>
            <TouchableOpacity
              onPress={() => setShowCreateTenant(true)}
              style={styles.sectionAction}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          {tenants.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No tenants found</Text>
              <Text style={styles.emptySubtext}>Create your first tenant to get started</Text>
            </View>
          ) : (
            <FlatList
              key="tenants-list"
              data={tenants}
              renderItem={renderTenant}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {selectedTenant && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Organizations in {selectedTenant.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setOrgForm({ ...orgForm, tenantId: selectedTenant.id });
                  setShowCreateOrganization(true);
                }}
                style={styles.sectionAction}
              >
                <Ionicons name="add" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
            
            {organizations.filter(org => org.tenantId === selectedTenant.id).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No organizations found</Text>
                <Text style={styles.emptySubtext}>Create an organization to organize your songs</Text>
              </View>
            ) : (
              <FlatList
                key={`orgs-${selectedTenant.id}`}
                data={organizations.filter(org => org.tenantId === selectedTenant.id)}
                renderItem={renderOrganization}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Tenant Modal */}
      <Modal
        visible={showCreateTenant}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateTenant(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Tenant</Text>
            <TouchableOpacity onPress={handleCreateTenant}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Tenant Name *</Text>
            <TextInput
              style={styles.input}
              value={tenantForm.name}
              onChangeText={(text) => setTenantForm({ ...tenantForm, name: text })}
              placeholder="Enter tenant name"
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={tenantForm.description}
              onChangeText={(text) => setTenantForm({ ...tenantForm, description: text })}
              placeholder="Enter description"
              multiline
              numberOfLines={3}
            />
            
            <Text style={styles.inputLabel}>Domain (Optional)</Text>
            <TextInput
              style={styles.input}
              value={tenantForm.domain}
              onChangeText={(text) => setTenantForm({ ...tenantForm, domain: text })}
              placeholder="e.g., mycompany.com"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Create Organization Modal */}
      <Modal
        visible={showCreateOrganization}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateOrganization(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Organization</Text>
            <TouchableOpacity onPress={handleCreateOrganization}>
              <Text style={styles.modalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Organization Name *</Text>
            <TextInput
              style={styles.input}
              value={orgForm.name}
              onChangeText={(text) => setOrgForm({ ...orgForm, name: text })}
              placeholder="Enter organization name"
            />
            
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={orgForm.description}
              onChangeText={(text) => setOrgForm({ ...orgForm, description: text })}
              placeholder="Enter description"
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionAction: {
    padding: 4,
  },
  tenantCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tenantDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tenantMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  orgCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orgInfoContent: {
    flex: 1,
  },
  songAssignmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
  },
  songAssignmentText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orgDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  orgMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSave: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
});

export default TenantManagementScreen;
