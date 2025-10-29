import { ref, set, get, push, remove, update, onValue, off } from 'firebase/database';
import { database } from '../config/firebase';
import { UserGroup, GroupMembership, AdminUserView, GroupFormData, UserAssignmentForm } from '../types/group';

class GroupService {
  private static instance: GroupService;

  private constructor() {}

  public static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  // Group Management
  public async createGroup(groupData: GroupFormData, createdBy: string): Promise<string> {
    try {
      const groupRef = push(ref(database, 'userGroups'));
      const groupId = groupRef.key!;
      
      const newGroup: UserGroup = {
        id: groupId,
        name: groupData.name,
        description: groupData.description,
        members: [],
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        color: groupData.color,
        icon: groupData.icon
      };

      await set(groupRef, newGroup);
      return groupId;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  public async updateGroup(groupId: string, updates: Partial<UserGroup>): Promise<void> {
    try {
      const groupRef = ref(database, `userGroups/${groupId}`);
      await update(groupRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  public async deleteGroup(groupId: string): Promise<void> {
    try {
      // Remove group
      const groupRef = ref(database, `userGroups/${groupId}`);
      await remove(groupRef);

      // Remove all memberships for this group
      const membershipsRef = ref(database, 'groupMemberships');
      const snapshot = await get(membershipsRef);
      
      if (snapshot.exists()) {
        const memberships = snapshot.val();
        const updates: { [key: string]: null } = {};
        
        Object.keys(memberships).forEach(userId => {
          if (memberships[userId][groupId]) {
            updates[`${userId}/${groupId}`] = null;
          }
        });
        
        if (Object.keys(updates).length > 0) {
          await update(ref(database, 'groupMemberships'), updates);
        }
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  public async getAllGroups(): Promise<UserGroup[]> {
    try {
      const groupsRef = ref(database, 'userGroups');
      const snapshot = await get(groupsRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      const groups = snapshot.val();
      return Object.values(groups).filter((group: any) => group.isActive);
    } catch (error) {
      console.error('Error fetching groups:', error);
      throw error;
    }
  }

  // User Management
  public async getAllUsersForAdmin(): Promise<AdminUserView[]> {
    try {
      const usersRef = ref(database, 'users');
      const membershipsRef = ref(database, 'groupMemberships');
      
      const [usersSnapshot, membershipsSnapshot] = await Promise.all([
        get(usersRef),
        get(membershipsRef)
      ]);

      if (!usersSnapshot.exists()) {
        return [];
      }

      const users = usersSnapshot.val();
      const memberships = membershipsSnapshot.exists() ? membershipsSnapshot.val() : {};

      return Object.values(users).map((user: any) => ({
        ...user,
        displayName: user.displayName || user.email || 'Unknown User',
        email: user.email || 'No Email',
        groupMemberships: memberships[user.id] ? Object.keys(memberships[user.id]) : [],
        lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : new Date(),
        isOnline: false, // This would need to be implemented with presence
        totalSongsPlayed: user.stats?.totalSessions || 0,
        joinDate: user.createdAt ? new Date(user.createdAt) : new Date()
      }));
    } catch (error) {
      console.error('Error fetching users for admin:', error);
      throw error;
    }
  }

  // User-Group Assignment
  public async assignUsersToGroups(assignment: UserAssignmentForm, assignedBy: string): Promise<void> {
    try {
      const updates: { [key: string]: any } = {};
      const now = new Date();

      for (const userId of assignment.userIds) {
        for (const groupId of assignment.groupIds) {
          if (assignment.action === 'add') {
            // Add user to group membership
            updates[`groupMemberships/${userId}/${groupId}`] = {
              addedBy: assignedBy,
              addedAt: now.toISOString(),
              isActive: true
            };
            
            // Add user to group's members list
            const groupRef = ref(database, `userGroups/${groupId}`);
            const groupSnapshot = await get(groupRef);
            
            if (groupSnapshot.exists()) {
              const groupData = groupSnapshot.val();
              const currentMembers = groupData.members || [];
              
              if (!currentMembers.includes(userId)) {
                updates[`userGroups/${groupId}/members`] = [...currentMembers, userId];
                updates[`userGroups/${groupId}/updatedAt`] = now.toISOString();
              }
            }
          } else {
            // Remove user from group membership
            updates[`groupMemberships/${userId}/${groupId}`] = null;
            
            // Remove user from group's members list
            const groupRef = ref(database, `userGroups/${groupId}`);
            const groupSnapshot = await get(groupRef);
            
            if (groupSnapshot.exists()) {
              const groupData = groupSnapshot.val();
              const currentMembers = groupData.members || [];
              
              updates[`userGroups/${groupId}/members`] = currentMembers.filter((id: string) => id !== userId);
              updates[`userGroups/${groupId}/updatedAt`] = now.toISOString();
            }
          }
        }
      }

      await update(ref(database), updates);
    } catch (error) {
      console.error('Error assigning users to groups:', error);
      throw error;
    }
  }

  public async getUserGroups(userId: string): Promise<UserGroup[]> {
    try {
      const membershipsRef = ref(database, `groupMemberships/${userId}`);
      const snapshot = await get(membershipsRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      const memberships = snapshot.val();
      const groupIds = Object.keys(memberships).filter(groupId => memberships[groupId].isActive);
      
      if (groupIds.length === 0) {
        return [];
      }

      const groupPromises = groupIds.map(groupId => 
        get(ref(database, `userGroups/${groupId}`))
      );
      
      const groupSnapshots = await Promise.all(groupPromises);
      const groups = groupSnapshots
        .filter(snapshot => snapshot.exists())
        .map(snapshot => snapshot.val())
        .filter(group => group.isActive);

      return groups;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      throw error;
    }
  }


  // Real-time listeners
  public onGroupsChange(callback: (groups: UserGroup[]) => void): () => void {
    const groupsRef = ref(database, 'userGroups');
    
    const listener = onValue(groupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const groups = Object.values(snapshot.val()).filter((group: any) => group.isActive);
        callback(groups as UserGroup[]);
      } else {
        callback([]);
      }
    });

    return () => off(groupsRef, 'value', listener);
  }

  public onUsersChange(callback: (users: AdminUserView[]) => void): () => void {
    const usersRef = ref(database, 'users');
    
    const listener = onValue(usersRef, async (snapshot) => {
      if (snapshot.exists()) {
        const users = await this.getAllUsersForAdmin();
        callback(users);
      } else {
        callback([]);
      }
    });

    return () => off(usersRef, 'value', listener);
  }
}

export default GroupService;
