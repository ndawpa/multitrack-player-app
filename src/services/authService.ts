import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  sendEmailVerification,
  applyActionCode,
  checkActionCode,
  User as FirebaseUser
} from 'firebase/auth';
import { ref, set, get, onValue, off } from 'firebase/database';
import { auth, database } from '../config/firebase';
import { User, UserPreferences, UserStats, AuthUser, LoginForm, SignupForm, ProfileUpdateForm, PasswordResetForm, PasswordResetConfirmForm, FilterState } from '../types/user';

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private authStateListeners: ((user: User | null) => void)[] = [];

  private getDefaultFilterState(): FilterState {
    return {
      searchQuery: '',
      selectedArtists: [],
      showFavoritesOnly: false,
      hasTracks: false,
      hasLyrics: false,
      hasScores: false,
      hasLinks: false,
      sortOrder: 'asc'
    };
  }

  private constructor() {
    console.log('AuthService: Initializing');
    // Listen to auth state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('AuthService: Firebase auth state changed', { uid: firebaseUser?.uid, emailVerified: firebaseUser?.emailVerified });
      if (firebaseUser) {
        // Only load user profile if email is verified
        if (firebaseUser.emailVerified) {
          await this.loadUserProfile(firebaseUser.uid);
        } else {
          // If email is not verified, sign out the user and clear current user
          console.log('AuthService: Email not verified, signing out user');
          await signOut(auth);
          this.currentUser = null;
          this.notifyAuthStateListeners(null);
        }
      } else {
        this.currentUser = null;
        this.notifyAuthStateListeners(null);
      }
    });
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  private notifyAuthStateListeners(user: User | null): void {
    console.log('AuthService: Notifying listeners', { userCount: this.authStateListeners.length, user: user ? 'logged in' : 'logged out' });
    this.authStateListeners.forEach(callback => callback(user));
  }

  private cleanUserDataForFirebase(user: User): any {
    const cleanedData: any = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatar: user.avatar || null,
      preferences: user.preferences,
      stats: {
        totalSessions: user.stats.totalSessions,
        totalPlayTime: user.stats.totalPlayTime,
        joinedDate: user.stats.joinedDate.toISOString(),
        favoriteArtists: user.stats.favoriteArtists || [],
        favoriteSongs: user.stats.favoriteSongs || []
      },
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString()
    };

    // Only include lastSessionDate if it exists
    if (user.stats.lastSessionDate) {
      cleanedData.stats.lastSessionDate = user.stats.lastSessionDate.toISOString();
    }

    return cleanedData;
  }

  public async signIn(credentials: LoginForm): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        credentials.email, 
        credentials.password
      );
      
      // Check if email is verified
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email address before signing in. Check your inbox for a verification link.');
      }
      
      await this.loadUserProfile(userCredential.user.uid);
      
      if (!this.currentUser) {
        throw new Error('Failed to load user profile');
      }
      
      return this.currentUser;
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/password authentication is not enabled. Please contact support.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else {
        throw new Error(error.message || 'An error occurred during sign in.');
      }
    }
  }

  public async signUp(userData: SignupForm): Promise<{ user: User; needsVerification: boolean }> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        userData.email, 
        userData.password
      );
      
      // Update display name
      await updateProfile(userCredential.user, {
        displayName: userData.displayName
      });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Create user profile in database
      const defaultPreferences: UserPreferences = {
        theme: 'auto',
        defaultPlaybackSpeed: 1.0,
        autoPlay: false,
        notifications: true,
        language: 'en',
        filters: this.getDefaultFilterState()
      };

      const defaultStats: UserStats = {
        totalSessions: 0,
        totalPlayTime: 0,
        joinedDate: new Date(),
        favoriteArtists: [],
        favoriteSongs: []
      };

      const userProfile: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email!,
        displayName: userData.displayName,
        avatar: userCredential.user.photoURL || null,
        preferences: defaultPreferences,
        stats: defaultStats,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        emailVerified: false
      };

      // Save to database
      const userRef = ref(database, `users/${userCredential.user.uid}`);
      await set(userRef, this.cleanUserDataForFirebase(userProfile));

      // Sign out the user immediately after signup to prevent automatic login
      await signOut(auth);
      
      return { user: userProfile, needsVerification: true };
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/password authentication is not enabled. Please contact support.');
      } else if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else {
        throw new Error(error.message || 'An error occurred during sign up.');
      }
    }
  }

  public async signOut(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.notifyAuthStateListeners(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  private async loadUserProfile(uid: string): Promise<void> {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Debug logging for date values
        console.log('Raw user data dates:', {
          createdAt: userData.createdAt,
          lastActiveAt: userData.lastActiveAt,
          joinedDate: userData.stats?.joinedDate,
          lastSessionDate: userData.stats?.lastSessionDate
        });
        
        // Helper function to safely parse dates
        const safeParseDate = (dateString: string, fallback: Date = new Date()): Date => {
          try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
              console.warn('Invalid date string, using fallback:', dateString);
              return fallback;
            }
            return date;
          } catch (error) {
            console.warn('Error parsing date, using fallback:', dateString, error);
            return fallback;
          }
        };

        this.currentUser = {
          ...userData,
          avatar: userData.avatar || null,
          createdAt: safeParseDate(userData.createdAt),
          lastActiveAt: safeParseDate(userData.lastActiveAt),
          emailVerified: auth.currentUser?.emailVerified || false,
          stats: {
            ...userData.stats,
            joinedDate: safeParseDate(userData.stats.joinedDate),
            lastSessionDate: userData.stats.lastSessionDate ? safeParseDate(userData.stats.lastSessionDate) : undefined
          }
        };

        // Debug logging
        console.log('Loaded user profile from database:', {
          id: this.currentUser.id,
          displayName: this.currentUser.displayName,
          avatar: this.currentUser.avatar,
          avatarType: typeof this.currentUser.avatar,
          rawAvatar: userData.avatar
        });

        // Clean up undefined values if they exist in the database
        if (userData.avatar === undefined || userData.stats?.lastSessionDate === undefined) {
          console.log('Found undefined values in database, cleaning up...');
          await this.cleanupUserData();
        }

        this.notifyAuthStateListeners(this.currentUser);
      } else {
        console.log('User profile not found, creating default profile');
        // Create a default profile if none exists
        const defaultPreferences: UserPreferences = {
          theme: 'auto',
          defaultPlaybackSpeed: 1.0,
          autoPlay: false,
          notifications: true,
          language: 'en',
          filters: this.getDefaultFilterState()
        };

        const defaultStats: UserStats = {
          totalSessions: 0,
          totalPlayTime: 0,
          joinedDate: new Date(),
          favoriteArtists: [],
          favoriteSongs: []
        };

        const defaultUser: User = {
          id: uid,
          email: auth.currentUser?.email || '',
          displayName: auth.currentUser?.displayName || 'User',
          avatar: auth.currentUser?.photoURL || null,
          preferences: defaultPreferences,
          stats: defaultStats,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          emailVerified: auth.currentUser?.emailVerified || false
        };

        // Save default profile to database
        await set(userRef, this.cleanUserDataForFirebase(defaultUser));
        this.currentUser = defaultUser;
        this.notifyAuthStateListeners(defaultUser);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // If there's an error loading the profile, create a default one
      try {
        console.log('Creating fallback user profile due to error');
        const userRef = ref(database, `users/${uid}`);
        const defaultPreferences: UserPreferences = {
          theme: 'auto',
          defaultPlaybackSpeed: 1.0,
          autoPlay: false,
          notifications: true,
          language: 'en',
          filters: this.getDefaultFilterState()
        };

        const defaultStats: UserStats = {
          totalSessions: 0,
          totalPlayTime: 0,
          joinedDate: new Date(),
          favoriteArtists: [],
          favoriteSongs: []
        };

        const fallbackUser: User = {
          id: uid,
          email: auth.currentUser?.email || '',
          displayName: auth.currentUser?.displayName || 'User',
          avatar: null,
          preferences: defaultPreferences,
          stats: defaultStats,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          emailVerified: auth.currentUser?.emailVerified || false
        };

        await set(userRef, this.cleanUserDataForFirebase(fallbackUser));
        this.currentUser = fallbackUser;
        this.notifyAuthStateListeners(fallbackUser);
      } catch (fallbackError) {
        console.error('Error creating fallback user profile:', fallbackError);
        throw new Error('Failed to load user profile');
      }
    }
  }

  public async updateProfile(updates: ProfileUpdateForm): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${this.currentUser.id}`);
      
      // Update local user object
      this.currentUser = {
        ...this.currentUser,
        ...updates,
        avatar: updates.avatar !== undefined ? (updates.avatar || null) : (this.currentUser.avatar || null),
        preferences: {
          ...this.currentUser.preferences,
          ...updates.preferences
        }
      };

      // Ensure avatar is never undefined before saving
      if (this.currentUser.avatar === undefined) {
        this.currentUser.avatar = null;
      }

      // Debug logging
      console.log('Updating profile with user data:', {
        id: this.currentUser.id,
        displayName: this.currentUser.displayName,
        avatar: this.currentUser.avatar,
        avatarType: typeof this.currentUser.avatar
      });

      // Update in database
      await set(userRef, this.cleanUserDataForFirebase(this.currentUser));
      
      // Update Firebase Auth profile if needed
      if (updates.displayName) {
        await updateProfile(auth.currentUser!, {
          displayName: updates.displayName
        });
      }

      this.notifyAuthStateListeners(this.currentUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  public async updateUserStats(statsUpdate: Partial<UserStats>): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${this.currentUser.id}/stats`);
      
      // Update local user object
      this.currentUser.stats = {
        ...this.currentUser.stats,
        ...statsUpdate
      };

      // Update in database
      await set(userRef, this.currentUser.stats);
      
      this.notifyAuthStateListeners(this.currentUser);
    } catch (error) {
      console.error('Error updating user stats:', error);
      throw error;
    }
  }

  public async updateFilterPreferences(filterState: Partial<FilterState>): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${this.currentUser.id}/preferences/filters`);
      
      // Update local user object
      this.currentUser.preferences.filters = {
        ...this.currentUser.preferences.filters,
        ...filterState
      };

      // Update in database
      await set(userRef, this.currentUser.preferences.filters);
      
      this.notifyAuthStateListeners(this.currentUser);
    } catch (error) {
      console.error('Error updating filter preferences:', error);
      throw error;
    }
  }

  public async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Password reset email error:', error);
      
      // Provide user-friendly error messages
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please try again later.');
      } else {
        throw new Error(error.message || 'An error occurred while sending the reset email.');
      }
    }
  }

  public async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      return await verifyPasswordResetCode(auth, code);
    } catch (error: any) {
      console.error('Password reset code verification error:', error);
      
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired reset code.');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Reset code has expired. Please request a new one.');
      } else {
        throw new Error(error.message || 'Invalid reset code.');
      }
    }
  }

  public async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(auth, code, newPassword);
    } catch (error: any) {
      console.error('Password reset confirmation error:', error);
      
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired reset code.');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Reset code has expired. Please request a new one.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      } else {
        throw new Error(error.message || 'An error occurred while resetting the password.');
      }
    }
  }

  public async sendEmailVerification(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in.');
      }
      await sendEmailVerification(user);
    } catch (error: any) {
      console.error('Send email verification error:', error);
      throw new Error(error.message || 'An error occurred while sending verification email.');
    }
  }

  public async verifyEmail(code: string): Promise<void> {
    try {
      await applyActionCode(auth, code);
    } catch (error: any) {
      console.error('Email verification error:', error);
      
      if (error.code === 'auth/invalid-action-code') {
        throw new Error('Invalid or expired verification code.');
      } else if (error.code === 'auth/expired-action-code') {
        throw new Error('Verification code has expired. Please request a new one.');
      } else {
        throw new Error(error.message || 'An error occurred while verifying the email.');
      }
    }
  }

  public async checkEmailVerificationStatus(): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return false;
      }
      await user.reload();
      return user.emailVerified;
    } catch (error: any) {
      console.error('Check email verification status error:', error);
      return false;
    }
  }

  public async handleUnverifiedUser(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (user && !user.emailVerified) {
        console.log('AuthService: User email not verified, signing out');
        await signOut(auth);
        this.currentUser = null;
        this.notifyAuthStateListeners(null);
      }
    } catch (error: any) {
      console.error('Handle unverified user error:', error);
    }
  }

  /**
   * Clean up any undefined values in the database
   */
  public async cleanupUserData(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const userRef = ref(database, `users/${this.currentUser.id}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        let needsCleanup = false;
        
        // Check for undefined values that need cleanup
        if (userData.avatar === undefined || 
            userData.stats?.lastSessionDate === undefined) {
          console.log('Cleaning up undefined values in database');
          needsCleanup = true;
        }
        
        if (needsCleanup) {
          // Ensure all undefined values are properly handled
          const cleanedUser = {
            ...this.currentUser,
            avatar: this.currentUser.avatar || null,
            stats: {
              ...this.currentUser.stats,
              lastSessionDate: this.currentUser.stats.lastSessionDate || undefined
            }
          };
          
          // Use current timestamp for any invalid dates
          const now = new Date();
          if (isNaN(cleanedUser.createdAt.getTime())) {
            cleanedUser.createdAt = now;
          }
          if (isNaN(cleanedUser.lastActiveAt.getTime())) {
            cleanedUser.lastActiveAt = now;
          }
          if (isNaN(cleanedUser.stats.joinedDate.getTime())) {
            cleanedUser.stats.joinedDate = now;
          }
          
          await set(userRef, this.cleanUserDataForFirebase(cleanedUser));
        }
      }
    } catch (error) {
      console.error('Error cleaning up user data:', error);
      throw error;
    }
  }
}

export default AuthService;
