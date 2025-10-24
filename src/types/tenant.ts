export interface Tenant {
  id: string;
  name: string;
  description?: string;
  domain?: string; // Optional domain for tenant identification
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the tenant
  isActive: boolean;
}

export interface TenantSettings {
  allowUserRegistration: boolean;
  requireAdminApproval: boolean;
  maxUsers?: number;
  allowedFileTypes: string[];
  maxFileSize: number; // in MB
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface Organization {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string; // For hierarchical organizations
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface OrganizationSettings {
  allowSubOrganizations: boolean;
  maxSubOrganizations?: number;
  songAccessLevel: 'public' | 'private' | 'restricted';
  canCreateSongs: boolean;
  canEditSongs: boolean;
  canDeleteSongs: boolean;
}

export interface UserTenantAssignment {
  id: string;
  userId: string;
  tenantId: string;
  organizationId?: string;
  role: TenantRole;
  permissions: TenantPermissions;
  assignedAt: Date;
  assignedBy: string;
  isActive: boolean;
}

export interface TenantRole {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: TenantPermissions;
  isSystemRole: boolean; // System roles like 'owner', 'admin', 'member'
  createdAt: Date;
  createdBy: string;
}

export interface TenantPermissions {
  // User management
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canAssignRoles: boolean;
  canViewAllUsers: boolean;
  
  // Organization management
  canCreateOrganizations: boolean;
  canEditOrganizations: boolean;
  canDeleteOrganizations: boolean;
  canAssignUsersToOrganizations: boolean;
  
  // Song management
  canCreateSongs: boolean;
  canEditAllSongs: boolean;
  canDeleteAllSongs: boolean;
  canViewAllSongs: boolean;
  canAssignSongsToOrganizations: boolean;
  
  // Tenant management
  canEditTenantSettings: boolean;
  canDeleteTenant: boolean;
  canViewTenantAnalytics: boolean;
}

export interface SongAccess {
  id: string;
  songId: string;
  tenantId: string;
  organizationId?: string; // If null, song is accessible to entire tenant
  accessLevel: 'public' | 'private' | 'restricted';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface TenantInvitation {
  id: string;
  tenantId: string;
  organizationId?: string;
  email: string;
  roleId: string;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
}

// Form interfaces for UI
export interface CreateTenantForm {
  name: string;
  description?: string;
  domain?: string;
  settings: Partial<TenantSettings>;
}

export interface CreateOrganizationForm {
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string;
  settings: Partial<OrganizationSettings>;
}

export interface InviteUserForm {
  tenantId: string;
  organizationId?: string;
  email: string;
  roleId: string;
  message?: string;
}

export interface AssignSongToOrganizationForm {
  songId: string;
  organizationId: string;
  accessLevel: 'public' | 'private' | 'restricted';
  expiresAt?: Date;
}

// Default system roles
export const DEFAULT_TENANT_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
} as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, TenantPermissions> = {
  owner: {
    canInviteUsers: true,
    canRemoveUsers: true,
    canAssignRoles: true,
    canViewAllUsers: true,
    canCreateOrganizations: true,
    canEditOrganizations: true,
    canDeleteOrganizations: true,
    canAssignUsersToOrganizations: true,
    canCreateSongs: true,
    canEditAllSongs: true,
    canDeleteAllSongs: true,
    canViewAllSongs: true,
    canAssignSongsToOrganizations: true,
    canEditTenantSettings: true,
    canDeleteTenant: true,
    canViewTenantAnalytics: true,
  },
  admin: {
    canInviteUsers: true,
    canRemoveUsers: true,
    canAssignRoles: true,
    canViewAllUsers: true,
    canCreateOrganizations: true,
    canEditOrganizations: true,
    canDeleteOrganizations: false,
    canAssignUsersToOrganizations: true,
    canCreateSongs: true,
    canEditAllSongs: true,
    canDeleteAllSongs: false,
    canViewAllSongs: true,
    canAssignSongsToOrganizations: true,
    canEditTenantSettings: false,
    canDeleteTenant: false,
    canViewTenantAnalytics: true,
  },
  member: {
    canInviteUsers: false,
    canRemoveUsers: false,
    canAssignRoles: false,
    canViewAllUsers: false,
    canCreateOrganizations: false,
    canEditOrganizations: false,
    canDeleteOrganizations: false,
    canAssignUsersToOrganizations: false,
    canCreateSongs: true,
    canEditAllSongs: false,
    canDeleteAllSongs: false,
    canViewAllSongs: true,
    canAssignSongsToOrganizations: false,
    canEditTenantSettings: false,
    canDeleteTenant: false,
    canViewTenantAnalytics: false,
  },
  viewer: {
    canInviteUsers: false,
    canRemoveUsers: false,
    canAssignRoles: false,
    canViewAllUsers: false,
    canCreateOrganizations: false,
    canEditOrganizations: false,
    canDeleteOrganizations: false,
    canAssignUsersToOrganizations: false,
    canCreateSongs: false,
    canEditAllSongs: false,
    canDeleteAllSongs: false,
    canViewAllSongs: true,
    canAssignSongsToOrganizations: false,
    canEditTenantSettings: false,
    canDeleteTenant: false,
    canViewTenantAnalytics: false,
  }
};
