import { ref, set, get, push, update, remove, query, orderByChild, equalTo, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';
import { 
  Tenant, 
  Organization, 
  UserTenantAssignment, 
  TenantRole, 
  SongAccess, 
  TenantInvitation,
  CreateTenantForm,
  CreateOrganizationForm,
  InviteUserForm,
  AssignSongToOrganizationForm,
  DEFAULT_TENANT_ROLES,
  DEFAULT_ROLE_PERMISSIONS
} from '../types/tenant';

class TenantService {
  private static instance: TenantService;

  private constructor() {}

  public static getInstance(): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService();
    }
    return TenantService.instance;
  }

  // Tenant Management
  public async createTenant(tenantData: CreateTenantForm, createdBy: string): Promise<Tenant> {
    try {
      const tenantId = this.generateId();
      const now = new Date();
      
      const tenant: Tenant = {
        id: tenantId,
        name: tenantData.name,
        description: tenantData.description,
        domain: tenantData.domain,
        settings: {
          allowUserRegistration: true,
          requireAdminApproval: false,
          allowedFileTypes: ['mp3', 'wav', 'm4a'],
          maxFileSize: 50,
          ...tenantData.settings
        },
        createdAt: now,
        updatedAt: now,
        createdBy,
        isActive: true
      };

      // Save tenant to database
      const tenantRef = ref(database, `tenants/${tenantId}`);
      await set(tenantRef, this.cleanTenantDataForFirebase(tenant));

      // Create default roles for the tenant
      await this.createDefaultRoles(tenantId, createdBy);

      // Assign creator as owner
      await this.assignUserToTenant(createdBy, tenantId, undefined, 'owner');

      return tenant;
    } catch (error) {
      console.error('Error creating tenant:', error);
      throw error;
    }
  }

  public async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      const tenantRef = ref(database, `tenants/${tenantId}`);
      const snapshot = await get(tenantRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        return this.parseTenantFromFirebase(data);
      }
      return null;
    } catch (error) {
      console.error('Error getting tenant:', error);
      throw error;
    }
  }

  public async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<void> {
    try {
      const tenantRef = ref(database, `tenants/${tenantId}`);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await update(tenantRef, updateData);
    } catch (error) {
      console.error('Error updating tenant:', error);
      throw error;
    }
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    try {
      const tenantRef = ref(database, `tenants/${tenantId}`);
      await remove(tenantRef);
      
      // Also remove all related data
      const organizationsRef = ref(database, `organizations`);
      const orgsSnapshot = await get(organizationsRef);
      if (orgsSnapshot.exists()) {
        const orgs = orgsSnapshot.val();
        for (const [orgId, org] of Object.entries(orgs)) {
          if ((org as any).tenantId === tenantId) {
            await remove(ref(database, `organizations/${orgId}`));
          }
        }
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      throw error;
    }
  }

  // Organization Management
  public async createOrganization(orgData: CreateOrganizationForm, createdBy: string): Promise<Organization> {
    try {
      const orgId = this.generateId();
      const now = new Date();
      
      const organization: Organization = {
        id: orgId,
        tenantId: orgData.tenantId,
        name: orgData.name,
        description: orgData.description,
        parentId: orgData.parentId || undefined,
        settings: {
          allowSubOrganizations: true,
          maxSubOrganizations: 10,
          songAccessLevel: 'public',
          canCreateSongs: true,
          canEditSongs: true,
          canDeleteSongs: false,
          ...orgData.settings
        },
        createdAt: now,
        updatedAt: now,
        createdBy,
        isActive: true
      };

      const orgRef = ref(database, `organizations/${orgId}`);
      await set(orgRef, this.cleanOrganizationDataForFirebase(organization));

      return organization;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  public async getOrganizationsByTenant(tenantId: string): Promise<Organization[]> {
    try {
      const orgsRef = ref(database, 'organizations');
      const snapshot = await get(orgsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const organizations: Organization[] = [];
        
        // Filter organizations for this tenant
        for (const [id, orgData] of Object.entries(data)) {
          const org = orgData as any;
          if (org.tenantId === tenantId) {
            organizations.push(this.parseOrganizationFromFirebase({ id, ...org }));
          }
        }
        return organizations;
      }
      return [];
    } catch (error) {
      console.error('Error getting organizations:', error);
      return [];
    }
  }

  public async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const orgRef = ref(database, `organizations/${orgId}`);
      const snapshot = await get(orgRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        return this.parseOrganizationFromFirebase(data);
      }
      return null;
    } catch (error) {
      console.error('Error getting organization:', error);
      throw error;
    }
  }

  // User Assignment Management
  public async assignUserToTenant(
    userId: string, 
    tenantId: string, 
    organizationId: string | undefined, 
    roleName: string
  ): Promise<UserTenantAssignment> {
    try {
      const assignmentId = this.generateId();
      const now = new Date();
      
      // Get role permissions
      const role = await this.getRoleByName(tenantId, roleName);
      if (!role) {
        throw new Error(`Role ${roleName} not found`);
      }

      const assignment: UserTenantAssignment = {
        id: assignmentId,
        userId,
        tenantId,
        organizationId: organizationId || undefined,
        role: role,
        permissions: role.permissions,
        assignedAt: now,
        assignedBy: 'system', // TODO: Get from current user context
        isActive: true
      };

      const assignmentRef = ref(database, `userTenantAssignments/${assignmentId}`);
      await set(assignmentRef, this.cleanAssignmentDataForFirebase(assignment));

      // Update user's current tenant/organization
      await this.updateUserCurrentTenant(userId, tenantId, organizationId);

      return assignment;
    } catch (error) {
      console.error('Error assigning user to tenant:', error);
      throw error;
    }
  }

  public async getUserTenantAssignments(userId: string): Promise<UserTenantAssignment[]> {
    try {
      const assignmentsRef = ref(database, 'userTenantAssignments');
      const snapshot = await get(assignmentsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const assignments: UserTenantAssignment[] = [];
        
        // Filter assignments for this user
        for (const [id, assignmentData] of Object.entries(data)) {
          const assignment = assignmentData as any;
          if (assignment.userId === userId) {
            assignments.push(this.parseAssignmentFromFirebase({ id, ...assignment }));
          }
        }
        return assignments;
      }
      return [];
    } catch (error) {
      console.error('Error getting user tenant assignments:', error);
      // Return empty array instead of throwing to prevent auth issues
      return [];
    }
  }

  public async getTenantUsers(tenantId: string): Promise<UserTenantAssignment[]> {
    try {
      const assignmentsRef = ref(database, 'userTenantAssignments');
      const snapshot = await get(assignmentsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const assignments: UserTenantAssignment[] = [];
        
        // Filter assignments for this tenant
        for (const [id, assignmentData] of Object.entries(data)) {
          const assignment = assignmentData as any;
          if (assignment.tenantId === tenantId) {
            assignments.push(this.parseAssignmentFromFirebase({ id, ...assignment }));
          }
        }
        return assignments;
      }
      return [];
    } catch (error) {
      console.error('Error getting tenant users:', error);
      return [];
    }
  }

  // Song Access Control
  public async assignSongToOrganization(songId: string, orgId: string, accessLevel: 'public' | 'private' | 'restricted', expiresAt?: Date): Promise<SongAccess> {
    try {
      const accessId = this.generateId();
      const now = new Date();
      
      const songAccess: SongAccess = {
        id: accessId,
        songId,
        tenantId: '', // Will be set based on organization
        organizationId: orgId,
        accessLevel,
        grantedBy: 'system', // TODO: Get from current user context
        grantedAt: now,
        expiresAt: expiresAt || undefined
      };

      // Get organization to determine tenant
      const org = await this.getOrganization(orgId);
      if (!org) {
        throw new Error('Organization not found');
      }
      songAccess.tenantId = org.tenantId;

      const accessRef = ref(database, `songAccess/${accessId}`);
      await set(accessRef, this.cleanSongAccessDataForFirebase(songAccess));

      return songAccess;
    } catch (error) {
      console.error('Error assigning song to organization:', error);
      throw error;
    }
  }

  public async getSongsForUser(userId: string, tenantId: string, organizationId?: string): Promise<string[]> {
    try {
      // Get user's assignments and permissions
      const assignments = await this.getUserTenantAssignments(userId);
      const userAssignment = assignments.find(a => a.tenantId === tenantId && a.isActive);
      
      if (!userAssignment) {
        return []; // User not assigned to this tenant
      }

      // If user can view all songs, return all songs in tenant
      if (userAssignment.permissions.canViewAllSongs) {
        const songsRef = ref(database, 'songs');
        const snapshot = await get(songsRef);
        if (snapshot.exists()) {
          const songs = snapshot.val();
          return Object.keys(songs).filter(songId => {
            const song = songs[songId];
            // Check if song belongs to this tenant (you'll need to add tenantId to songs)
            return song.tenantId === tenantId;
          });
        }
      }

      // Otherwise, get songs based on organization access
      const accessRef = ref(database, 'songAccess');
      const q = query(accessRef, orderByChild('tenantId'), equalTo(tenantId));
      const snapshot = await get(q);
      
      if (snapshot.exists()) {
        const accessData = snapshot.val();
        const accessibleSongs: string[] = [];
        
        for (const [accessId, access] of Object.entries(accessData)) {
          const songAccess = access as any;
          if (songAccess.organizationId === organizationId || 
              songAccess.accessLevel === 'public' ||
              (songAccess.accessLevel === 'restricted' && userAssignment.permissions.canViewAllSongs)) {
            accessibleSongs.push(songAccess.songId);
          }
        }
        return accessibleSongs;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting songs for user:', error);
      throw error;
    }
  }

  // Role Management
  private async createDefaultRoles(tenantId: string, createdBy: string): Promise<void> {
    const now = new Date();
    
    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = `${tenantId}-${roleName}`; // Use predictable IDs
      const role: TenantRole = {
        id: roleId,
        tenantId,
        name: roleName,
        description: `Default ${roleName} role`,
        permissions,
        isSystemRole: true,
        createdAt: now,
        createdBy
      };

      const roleRef = ref(database, `tenantRoles/${roleId}`);
      await set(roleRef, this.cleanRoleDataForFirebase(role));
    }
  }

  private async getRoleByName(tenantId: string, roleName: string): Promise<TenantRole | null> {
    try {
      // First try to get the role by predictable ID
      const roleId = `${tenantId}-${roleName}`;
      const roleRef = ref(database, `tenantRoles/${roleId}`);
      const snapshot = await get(roleRef);
      
      if (snapshot.exists()) {
        const roleData = snapshot.val();
        return this.parseRoleFromFirebase({ id: roleId, ...roleData });
      }
      
      // Fallback: search all roles for this tenant
      const rolesRef = ref(database, 'tenantRoles');
      const allRolesSnapshot = await get(rolesRef);
      
      if (allRolesSnapshot.exists()) {
        const data = allRolesSnapshot.val();
        for (const [id, roleData] of Object.entries(data)) {
          const role = roleData as any;
          if (role.tenantId === tenantId && role.name === roleName) {
            return this.parseRoleFromFirebase({ id, ...role });
          }
        }
      }
      
      // If no role found, create default permissions
      console.log(`Role ${roleName} not found for tenant ${tenantId}, using default permissions`);
      const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[roleName] || DEFAULT_ROLE_PERMISSIONS.member;
      
      return {
        id: roleId,
        tenantId,
        name: roleName,
        description: `Default ${roleName} role`,
        permissions: defaultPermissions,
        isSystemRole: true,
        createdAt: new Date(),
        createdBy: 'system'
      };
    } catch (error) {
      console.error('Error getting role by name:', error);
      // Return default member role as fallback
      return {
        id: `${tenantId}-${roleName}`,
        tenantId,
        name: roleName,
        description: `Default ${roleName} role`,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName] || DEFAULT_ROLE_PERMISSIONS.member,
        isSystemRole: true,
        createdAt: new Date(),
        createdBy: 'system'
      };
    }
  }

  // Utility methods
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}`;
  }

  private async updateUserCurrentTenant(userId: string, tenantId: string, organizationId?: string): Promise<void> {
    try {
      const userRef = ref(database, `users/${userId}`);
      const updates: any = {
        currentTenantId: tenantId
      };
      if (organizationId !== undefined) {
        updates.currentOrganizationId = organizationId;
      }
      await update(userRef, updates);
    } catch (error) {
      console.error('Error updating user current tenant:', error);
      throw error;
    }
  }

  // Data transformation methods
  private cleanTenantDataForFirebase(tenant: Tenant): any {
    return {
      ...tenant,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }

  private parseTenantFromFirebase(data: any): Tenant {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  private cleanOrganizationDataForFirebase(org: Organization): any {
    const cleanData: any = {
      id: org.id,
      tenantId: org.tenantId,
      name: org.name,
      description: org.description,
      settings: org.settings,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      createdBy: org.createdBy,
      isActive: org.isActive
    };
    
    // Only include parentId if it's not undefined
    if (org.parentId !== undefined) {
      cleanData.parentId = org.parentId;
    }
    
    return cleanData;
  }

  private parseOrganizationFromFirebase(data: any): Organization {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  private cleanAssignmentDataForFirebase(assignment: UserTenantAssignment): any {
    const cleanData: any = {
      id: assignment.id,
      userId: assignment.userId,
      tenantId: assignment.tenantId,
      role: assignment.role,
      permissions: assignment.permissions,
      assignedAt: assignment.assignedAt.toISOString(),
      assignedBy: assignment.assignedBy,
      isActive: assignment.isActive
    };
    
    // Only include organizationId if it's not undefined
    if (assignment.organizationId !== undefined) {
      cleanData.organizationId = assignment.organizationId;
    }
    
    return cleanData;
  }

  private parseAssignmentFromFirebase(data: any): UserTenantAssignment {
    return {
      ...data,
      assignedAt: new Date(data.assignedAt)
    };
  }

  private cleanSongAccessDataForFirebase(access: SongAccess): any {
    const cleanData: any = {
      id: access.id,
      songId: access.songId,
      tenantId: access.tenantId,
      organizationId: access.organizationId,
      accessLevel: access.accessLevel,
      grantedBy: access.grantedBy,
      grantedAt: access.grantedAt.toISOString()
    };
    
    // Only include expiresAt if it's not undefined
    if (access.expiresAt !== undefined) {
      cleanData.expiresAt = access.expiresAt.toISOString();
    }
    
    return cleanData;
  }

  private cleanRoleDataForFirebase(role: TenantRole): any {
    return {
      ...role,
      createdAt: role.createdAt.toISOString()
    };
  }

  private parseRoleFromFirebase(data: any): TenantRole {
    return {
      ...data,
      createdAt: new Date(data.createdAt)
    };
  }
}

export default TenantService;
