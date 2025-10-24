import { ref, get, query, orderByChild, equalTo, update } from 'firebase/database';
import { database } from '../config/firebase';
import TenantService from './tenantService';
import { Song } from '../types/song';

interface SongAccessFilter {
  tenantId: string;
  organizationId?: string;
  userId: string;
}

class SongAccessService {
  private static instance: SongAccessService;
  private tenantService: TenantService;

  private constructor() {
    this.tenantService = TenantService.getInstance();
  }

  public static getInstance(): SongAccessService {
    if (!SongAccessService.instance) {
      SongAccessService.instance = new SongAccessService();
    }
    return SongAccessService.instance;
  }

  /**
   * Filter songs based on user's tenant and organization access
   */
  public async filterSongsForUser(songs: Song[], userId: string, tenantId: string, organizationId?: string): Promise<Song[]> {
    try {
      // Get user's tenant assignments to check permissions
      const userAssignments = await this.tenantService.getUserTenantAssignments(userId);
      const userAssignment = userAssignments.find(a => a.tenantId === tenantId && a.isActive);
      
      if (!userAssignment) {
        console.log('User not assigned to tenant, returning empty songs');
        return [];
      }

      // If user can view all songs in tenant, return all songs for this tenant
      if (userAssignment.permissions.canViewAllSongs) {
        return songs.filter(song => 
          song.tenantId === tenantId && 
          (song.accessLevel === 'public' || song.accessLevel === 'restricted')
        );
      }

      // Otherwise, filter based on organization access
      const filteredSongs: Song[] = [];
      
      for (const song of songs) {
        if (song.tenantId !== tenantId) {
          continue; // Song doesn't belong to this tenant
        }

        // Check access level
        if (song.accessLevel === 'public') {
          filteredSongs.push(song);
        } else if (song.accessLevel === 'private' && song.organizationId === organizationId) {
          filteredSongs.push(song);
        } else if (song.accessLevel === 'restricted' && song.organizationId === organizationId) {
          filteredSongs.push(song);
        }
      }

      return filteredSongs;
    } catch (error) {
      console.error('Error filtering songs for user:', error);
      return [];
    }
  }

  /**
   * Check if user can perform action on song
   */
  public async canUserPerformAction(
    userId: string, 
    tenantId: string, 
    action: 'create' | 'edit' | 'delete' | 'view',
    song?: Song
  ): Promise<boolean> {
    try {
      const userAssignments = await this.tenantService.getUserTenantAssignments(userId);
      const userAssignment = userAssignments.find(a => a.tenantId === tenantId && a.isActive);
      
      if (!userAssignment) {
        return false;
      }

      switch (action) {
        case 'create':
          return userAssignment.permissions.canCreateSongs;
        case 'edit':
          return userAssignment.permissions.canEditAllSongs || 
                 (song && song.organizationId === userAssignment.organizationId && userAssignment.permissions.canEditSongs);
        case 'delete':
          return userAssignment.permissions.canDeleteAllSongs || 
                 (song && song.organizationId === userAssignment.organizationId && userAssignment.permissions.canDeleteSongs);
        case 'view':
          return userAssignment.permissions.canViewAllSongs || 
                 (song && song.organizationId === userAssignment.organizationId);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return false;
    }
  }

  /**
   * Get accessible songs for user with real-time updates
   */
  public async getAccessibleSongs(userId: string, tenantId: string, organizationId?: string): Promise<string[]> {
    try {
      return await this.tenantService.getSongsForUser(userId, tenantId, organizationId);
    } catch (error) {
      console.error('Error getting accessible songs:', error);
      return [];
    }
  }

  /**
   * Assign song to organization with specific access level
   */
  public async assignSongToOrganization(
    songId: string, 
    organizationId: string, 
    accessLevel: 'public' | 'private' | 'restricted',
    expiresAt?: Date
  ): Promise<void> {
    try {
      // First, update the song with tenant and organization info
      const songRef = ref(database, `songs/${songId}`);
      const songSnapshot = await get(songRef);
      
      if (songSnapshot.exists()) {
        const songData = songSnapshot.val();
        const updates: any = {
          organizationId,
          accessLevel,
          updatedAt: new Date().toISOString()
        };
        
        // Add tenantId if it doesn't exist
        if (!songData.tenantId) {
          // Get the organization to find its tenant
          const org = await this.tenantService.getOrganization(organizationId);
          if (org) {
            updates.tenantId = org.tenantId;
          }
        }
        
        await update(songRef, updates);
      }
      
      // Then create the song access record
      await this.tenantService.assignSongToOrganization(songId, organizationId, accessLevel);
    } catch (error) {
      console.error('Error assigning song to organization:', error);
      throw error;
    }
  }

  /**
   * Update song's tenant and organization information
   */
  public async updateSongTenantInfo(songId: string, tenantId: string, organizationId?: string, accessLevel?: 'public' | 'private' | 'restricted'): Promise<void> {
    try {
      const songRef = ref(database, `songs/${songId}`);
      const updates: any = {
        tenantId,
        updatedAt: new Date().toISOString()
      };
      
      if (organizationId) {
        updates.organizationId = organizationId;
      }
      
      if (accessLevel) {
        updates.accessLevel = accessLevel;
      }

      // Use Firebase update method
      const { update } = await import('firebase/database');
      await update(songRef, updates);
    } catch (error) {
      console.error('Error updating song tenant info:', error);
      throw error;
    }
  }

  /**
   * Get songs that belong to a specific tenant
   */
  public async getSongsByTenant(tenantId: string): Promise<Song[]> {
    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const songs: Song[] = [];
        
        // Show all songs to make them available for assignment
        // This allows you to assign any song to any organization
        for (const [id, songData] of Object.entries(data)) {
          const song = songData as any;
          songs.push({
            id,
            ...song
          } as Song);
        }
        
        return songs;
      }
      return [];
    } catch (error) {
      console.error('Error getting songs by tenant:', error);
      return [];
    }
  }

  /**
   * Get songs that belong to a specific organization
   */
  public async getSongsByOrganization(organizationId: string): Promise<Song[]> {
    try {
      const songsRef = ref(database, 'songs');
      const snapshot = await get(songsRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const songs: Song[] = [];
        
        // Filter songs for this organization
        for (const [id, songData] of Object.entries(data)) {
          const song = songData as any;
          if (song.organizationId === organizationId) {
            songs.push({
              id,
              ...song
            } as Song);
          }
        }
        return songs;
      }
      return [];
    } catch (error) {
      console.error('Error getting songs by organization:', error);
      return [];
    }
  }
}

export default SongAccessService;
