import { User } from './user';

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  members: string[]; // Array of user IDs
  createdBy: string; // Admin who created the group
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isAdmin?: boolean; // If true, members of this group have admin access
  color?: string; // For UI display
  icon?: string; // For UI display
}

export interface GroupMembership {
  userId: string;
  groupId: string;
  addedBy: string; // Admin who added the user
  addedAt: Date;
  isActive: boolean;
}

export interface GroupPermission {
  groupId: string;
  resourceType: 'song' | 'playlist' | 'category';
  resourceId: string;
  actions: ('read' | 'play' | 'download' | 'edit')[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

// Extended user interface for admin view
export interface AdminUserView extends User {
  groupMemberships: string[]; // Array of group IDs
  lastActiveAt: Date;
  isOnline: boolean;
  totalSongsPlayed: number;
  joinDate: Date;
}

// Group management form data
export interface GroupFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  isAdmin?: boolean; // If true, members of this group have admin access
}

// User assignment form data
export interface UserAssignmentForm {
  userIds: string[];
  groupIds: string[];
  action: 'add' | 'remove';
}
