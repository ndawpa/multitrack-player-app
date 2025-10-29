import { ref, set, get, update } from 'firebase/database';
import { database } from '../config/firebase';
import { UserGroup } from '../types/group';

export interface SongAccessControl {
  allowedUsers?: string[]; // User IDs who can access
  allowedGroups?: string[]; // Group IDs who can access
  visibility: 'public' | 'private' | 'group_restricted';
  accessLevel: 'read' | 'play' | 'download' | 'edit';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

class SongAccessService {
  private static instance: SongAccessService;

  private constructor() {}

  public static getInstance(): SongAccessService {
    if (!SongAccessService.instance) {
      SongAccessService.instance = new SongAccessService();
    }
    return SongAccessService.instance;
  }

  // Set access control for a song
  public async setSongAccess(
    songId: string, 
    accessControl: Partial<SongAccessControl>
  ): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const currentSong = await get(songRef);
      
      if (!currentSong.exists()) {
        throw new Error('Song not found');
      }

      const songData = currentSong.val();
      const updatedAccessControl = {
        ...songData.accessControl,
        ...accessControl,
        updatedAt: new Date()
      };

      await update(songRef, {
        accessControl: updatedAccessControl
      });
    } catch (error) {
      console.error('Error setting song access:', error);
      throw error;
    }
  }

  // Add users to song access
  public async addUsersToSongAccess(
    songId: string, 
    userIds: string[]
  ): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const currentSong = await get(songRef);
      
      if (!currentSong.exists()) {
        throw new Error('Song not found');
      }

      const songData = currentSong.val();
      const currentUsers = songData.accessControl?.allowedUsers || [];
      const updatedUsers = [...new Set([...currentUsers, ...userIds])];

      await this.setSongAccess(songId, {
        allowedUsers: updatedUsers
      });
    } catch (error) {
      console.error('Error adding users to song access:', error);
      throw error;
    }
  }

  // Add groups to song access
  public async addGroupsToSongAccess(
    songId: string, 
    groupIds: string[]
  ): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const currentSong = await get(songRef);
      
      if (!currentSong.exists()) {
        throw new Error('Song not found');
      }

      const songData = currentSong.val();
      const currentGroups = songData.accessControl?.allowedGroups || [];
      const updatedGroups = [...new Set([...currentGroups, ...groupIds])];

      await this.setSongAccess(songId, {
        allowedGroups: updatedGroups
      });
    } catch (error) {
      console.error('Error adding groups to song access:', error);
      throw error;
    }
  }

  // Remove users from song access
  public async removeUsersFromSongAccess(
    songId: string, 
    userIds: string[]
  ): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const currentSong = await get(songRef);
      
      if (!currentSong.exists()) {
        throw new Error('Song not found');
      }

      const songData = currentSong.val();
      const currentUsers = songData.accessControl?.allowedUsers || [];
      const updatedUsers = currentUsers.filter((userId: string) => !userIds.includes(userId));

      await this.setSongAccess(songId, {
        allowedUsers: updatedUsers
      });
    } catch (error) {
      console.error('Error removing users from song access:', error);
      throw error;
    }
  }

  // Remove groups from song access
  public async removeGroupsFromSongAccess(
    songId: string, 
    groupIds: string[]
  ): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const currentSong = await get(songRef);
      
      if (!currentSong.exists()) {
        throw new Error('Song not found');
      }

      const songData = currentSong.val();
      const currentGroups = songData.accessControl?.allowedGroups || [];
      const updatedGroups = currentGroups.filter((groupId: string) => !groupIds.includes(groupId));

      await this.setSongAccess(songId, {
        allowedGroups: updatedGroups
      });
    } catch (error) {
      console.error('Error removing groups from song access:', error);
      throw error;
    }
  }

  // Check if user has access to song
  public async checkUserAccess(
    songId: string, 
    userId: string
  ): Promise<boolean> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const songSnapshot = await get(songRef);
      
      if (!songSnapshot.exists()) {
        return false;
      }

      const songData = songSnapshot.val();
      const accessControl = songData.accessControl;

      // If no access control, song is public
      if (!accessControl) {
        return true;
      }

      // Check if song is public
      if (accessControl.visibility === 'public') {
        return true;
      }

      // Check if user is the creator
      if (songData.createdBy === userId) {
        return true;
      }

      // Check if user is in allowed users list
      if (accessControl.allowedUsers?.includes(userId)) {
        return true;
      }

      // Check if user is in any allowed groups
      if (accessControl.allowedGroups && accessControl.allowedGroups.length > 0) {
        const userGroupsRef = ref(database, `groupMemberships/${userId}`);
        const userGroupsSnapshot = await get(userGroupsRef);
        
        if (userGroupsSnapshot.exists()) {
          const userGroups = userGroupsSnapshot.val();
          const userGroupIds = Object.keys(userGroups).filter(
            groupId => userGroups[groupId]?.isActive
          );
          
          const hasGroupAccess = accessControl.allowedGroups.some(
            allowedGroupId => userGroupIds.includes(allowedGroupId)
          );
          
          if (hasGroupAccess) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }

  // Get songs accessible by user
  public async getAccessibleSongs(userId: string): Promise<string[]> {
    try {
      const songsRef = ref(database, 'songs');
      const songsSnapshot = await get(songsRef);
      
      if (!songsSnapshot.exists()) {
        return [];
      }

      const songs = songsSnapshot.val();
      const accessibleSongIds: string[] = [];

      for (const [songId, songData] of Object.entries(songs)) {
        const hasAccess = await this.checkUserAccess(songId, userId);
        if (hasAccess) {
          accessibleSongIds.push(songId);
        }
      }

      return accessibleSongIds;
    } catch (error) {
      console.error('Error getting accessible songs:', error);
      return [];
    }
  }
}

export default SongAccessService;
