import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';
import AuthService from './authService';
import GroupService from './groupService';

interface AIAssistantAccessConfig {
  enabled: boolean;
  allowedGroups?: string[]; // Group IDs that have access
  allowedUsers?: string[]; // Individual user IDs that have access (admins, etc.)
  visibility: 'public' | 'group_restricted' | 'private';
  updatedBy: string;
  updatedAt: Date;
}

interface AIConfig {
  apiKey?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  model?: string;
  updatedBy: string;
  updatedAt: Date;
}

class AIAssistantAccessService {
  private static instance: AIAssistantAccessService;
  private authService: AuthService;
  private groupService: GroupService;
  private readonly CONFIG_PATH = 'aiAssistantAccess';

  private constructor() {
    this.authService = AuthService.getInstance();
    this.groupService = GroupService.getInstance();
  }

  public static getInstance(): AIAssistantAccessService {
    if (!AIAssistantAccessService.instance) {
      AIAssistantAccessService.instance = new AIAssistantAccessService();
    }
    return AIAssistantAccessService.instance;
  }

  /**
   * Check if AI Assistant is enabled
   */
  public async isEnabled(): Promise<boolean> {
    try {
      const configRef = ref(database, `${this.CONFIG_PATH}/config`);
      const snapshot = await get(configRef);
      
      if (!snapshot.exists()) {
        // Default: enabled for everyone if no config exists
        return true;
      }

      const config = snapshot.val() as AIAssistantAccessConfig;
      return config.enabled !== false;
    } catch (error) {
      console.error('Error checking AI Assistant enabled status:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Check if user has access to AI Assistant
   */
  public async checkUserAccess(userId: string): Promise<boolean> {
    try {
      // Check if AI Assistant is enabled
      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        return false;
      }

      const configRef = ref(database, `${this.CONFIG_PATH}/config`);
      const snapshot = await get(configRef);
      
      if (!snapshot.exists()) {
        // No config = public access
        return true;
      }

      const config = snapshot.val() as AIAssistantAccessConfig;

      // If visibility is public, everyone has access
      if (config.visibility === 'public') {
        return true;
      }

      // Check if user is in allowed users list
      if (config.allowedUsers && config.allowedUsers.includes(userId)) {
        return true;
      }

      // Check if user is in any allowed groups
      if (config.allowedGroups && config.allowedGroups.length > 0) {
        const userGroups = await this.groupService.getUserGroups(userId);
        const userGroupIds = userGroups.map(group => group.id);
        
        const hasGroupAccess = config.allowedGroups.some(
          allowedGroupId => userGroupIds.includes(allowedGroupId)
        );
        
        if (hasGroupAccess) {
          return true;
        }
      }

      // If visibility is private and user is not in allowed lists, deny access
      if (config.visibility === 'private') {
        return false;
      }

      // Default: no access if group_restricted and not in groups
      return false;
    } catch (error) {
      console.error('Error checking AI Assistant access:', error);
      return false; // Default to no access on error for security
    }
  }

  /**
   * Get current access configuration (admin only)
   */
  public async getAccessConfig(): Promise<AIAssistantAccessConfig | null> {
    try {
      const configRef = ref(database, `${this.CONFIG_PATH}/config`);
      const snapshot = await get(configRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val() as AIAssistantAccessConfig;
    } catch (error) {
      console.error('Error getting AI Assistant access config:', error);
      return null;
    }
  }

  /**
   * Update access configuration (admin only)
   */
  public async updateAccessConfig(config: Partial<AIAssistantAccessConfig>): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to update access config');
    }

    try {
      const configRef = ref(database, `${this.CONFIG_PATH}/config`);
      const currentSnapshot = await get(configRef);
      
      const currentConfig = currentSnapshot.exists() 
        ? (currentSnapshot.val() as AIAssistantAccessConfig)
        : {
            enabled: true,
            visibility: 'public' as const,
            allowedGroups: [],
            allowedUsers: [],
            updatedBy: user.id,
            updatedAt: new Date()
          };

      const updatedConfig: AIAssistantAccessConfig = {
        ...currentConfig,
        ...config,
        updatedBy: user.id,
        updatedAt: new Date()
      };

      await set(configRef, {
        ...updatedConfig,
        updatedAt: updatedConfig.updatedAt.toISOString()
      });
    } catch (error) {
      console.error('Error updating AI Assistant access config:', error);
      throw error;
    }
  }

  /**
   * Set which groups have access to AI Assistant
   */
  public async setAllowedGroups(groupIds: string[]): Promise<void> {
    await this.updateAccessConfig({
      allowedGroups: groupIds,
      visibility: groupIds.length > 0 ? 'group_restricted' : 'public'
    });
  }

  /**
   * Add a group to allowed groups
   */
  public async addAllowedGroup(groupId: string): Promise<void> {
    const config = await this.getAccessConfig();
    const currentGroups = config?.allowedGroups || [];
    
    if (!currentGroups.includes(groupId)) {
      await this.updateAccessConfig({
        allowedGroups: [...currentGroups, groupId],
        visibility: 'group_restricted'
      });
    }
  }

  /**
   * Remove a group from allowed groups
   */
  public async removeAllowedGroup(groupId: string): Promise<void> {
    const config = await this.getAccessConfig();
    const currentGroups = config?.allowedGroups || [];
    
    await this.updateAccessConfig({
      allowedGroups: currentGroups.filter(id => id !== groupId),
      visibility: currentGroups.length <= 1 ? 'public' : 'group_restricted'
    });
  }

  /**
   * Enable or disable AI Assistant globally
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    await this.updateAccessConfig({ enabled });
  }

  /**
   * Check if current user is admin
   */
  public async isAdmin(): Promise<boolean> {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        return false;
      }

      const userRef = ref(database, `users/${user.id}/role`);
      const snapshot = await get(userRef);
      
      return snapshot.exists() && snapshot.val() === 'admin';
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Get AI configuration (API key, provider, model) - readable by all authenticated users
   */
  public async getAIConfig(): Promise<AIConfig | null> {
    try {
      const configRef = ref(database, `${this.CONFIG_PATH}/aiConfig`);
      const snapshot = await get(configRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val() as AIConfig;
    } catch (error) {
      console.error('Error getting AI config:', error);
      return null;
    }
  }

  /**
   * Update AI configuration (API key, provider, model) - admin only
   * @param config - Configuration to update
   * @param allowAdminMode - If true, allows update even if user doesn't have database admin role (for password-based admin mode)
   */
  public async updateAIConfig(config: Partial<AIConfig>, allowAdminMode: boolean = false): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('User must be logged in to update AI config');
    }

    // Check if user is admin (either database role or admin mode)
    const isAdmin = await this.isAdmin();
    if (!isAdmin && !allowAdminMode) {
      throw new Error('Only administrators can update AI configuration');
    }

    try {
      const configRef = ref(database, `${this.CONFIG_PATH}/aiConfig`);
      const currentSnapshot = await get(configRef);
      
      const currentConfig = currentSnapshot.exists() 
        ? (currentSnapshot.val() as AIConfig)
        : {
            apiKey: '',
            provider: 'google' as const,
            model: 'gemini-2.5-flash-lite',
            updatedBy: user.id,
            updatedAt: new Date()
          };

      const updatedConfig: AIConfig = {
        ...currentConfig,
        ...config,
        updatedBy: user.id,
        updatedAt: new Date()
      };

      await set(configRef, {
        ...updatedConfig,
        updatedAt: updatedConfig.updatedAt.toISOString()
      });
    } catch (error) {
      console.error('Error updating AI config:', error);
      throw error;
    }
  }
}

export default AIAssistantAccessService;
export type { AIAssistantAccessConfig, AIConfig };

