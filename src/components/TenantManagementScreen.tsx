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
        <Ionicons name="chevron-forward" size={20} color="#BBBBBB" />
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
      <View style={styles.orgHeader}>
        <View style={styles.orgInfoContent}>
          <Text style={styles.orgName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.orgDescription}>{item.description}</Text>
          )}
          <Text style={styles.orgMeta}>
            Created: {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.orgActions}>
          <TouchableOpacity
            style={styles.orgActionButton}
            onPress={() => {
              setSelectedOrganization(item);
              setShowUserManagement(true);
            }}
          >
            <Ionicons name="people" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.orgActionButton}
            onPress={() => {
              setSelectedOrganization(item);
              setShowSongAssignment(true);
            }}
          >
            <Ionicons name="musical-notes" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
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
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading tenant data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#BB86FC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Management</Text>
        <TouchableOpacity
          onPress={() => setShowCreateTenant(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#BB86FC" />
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
              <Ionicons name="add" size={20} color="#BB86FC" />
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
                <Ionicons name="add" size={20} color="#BB86FC" />
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
    color: '#FFFFFF',
  },
  sectionAction: {
    padding: 4,
  },
  tenantCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  tenantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tenantDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 4,
  },
  tenantMeta: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 8,
  },
  orgCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  orgActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgActionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#2A2A2A',
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
    color: '#BB86FC',
    marginLeft: 4,
    fontWeight: '500',
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orgDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 4,
  },
  orgMeta: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 8,
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
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#1E1E1E',
    color: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
});

export default TenantManagementScreen;
