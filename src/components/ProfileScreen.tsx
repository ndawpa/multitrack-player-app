import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { User } from '../types/user';
import Header from './Header';
import Button from './Button';
import { commonStyles, spacingStyles } from '../theme/layout';

interface ProfileScreenProps {
  onNavigateToSettings: () => void;
  onBack: () => void;
  onSignOut: () => void;
  isAdminMode?: boolean;
  onAdminModeChange?: (isAdmin: boolean) => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  onNavigateToSettings, 
  onBack,
  onSignOut,
  isAdminMode = false,
  onAdminModeChange
}) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const authService = AuthService.getInstance();
  const ADMIN_PASSWORD = 'admin123'; // You should change this to a more secure password

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              onSignOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const formatPlayTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handlePasswordVerification = () => {
    if (password === ADMIN_PASSWORD) {
      setShowPasswordDialog(false);
      setPassword('');
      setPasswordError('');
      onAdminModeChange?.(true);
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleAdminModeToggle = () => {
    if (isAdminMode) {
      onAdminModeChange?.(false);
    } else {
      setShowPasswordDialog(true);
      setPassword('');
      setPasswordError('');
    }
  };

  const handlePasswordDialogCancel = () => {
    setShowPasswordDialog(false);
    setPassword('');
    setPasswordError('');
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !user.stats) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container}>
      <Header title="Profile" onBack={onBack} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
      >
        {/* Header */}
        <View style={[commonStyles.section, styles.header]}>
          <View style={styles.avatarContainer}>
            {user.avatar && user.avatar !== null ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Ionicons name="person" size={40} color="#BB86FC" />
              </View>
            )}
          </View>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        {/* Stats Section */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.totalSessions || 0}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatPlayTime(user.stats.totalPlayTime || 0)}</Text>
              <Text style={styles.statLabel}>Play Time</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.favoriteArtists?.length || 0}</Text>
              <Text style={styles.statLabel}>Favorite Artists</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.favoriteSongs?.length || 0}</Text>
              <Text style={styles.statLabel}>Favorite Songs</Text>
            </View>
          </View>
        </View>

        {/* Account Info */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Account Info</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>{user.stats.joinedDate ? formatDate(user.stats.joinedDate) : 'Unknown'}</Text>
          </View>
          {user.stats.lastSessionDate && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Last session</Text>
              <Text style={styles.infoValue}>{formatDate(user.stats.lastSessionDate)}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleAdminModeToggle}>
            <Ionicons 
              name={isAdminMode ? "shield-checkmark" : "shield"} 
              size={20} 
              color={isAdminMode ? "#4CAF50" : "#BB86FC"} 
            />
            <Text style={[styles.actionText, isAdminMode && { color: '#4CAF50' }]}>
              {isAdminMode ? 'Admin Mode (Active)' : 'Admin Mode'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToSettings}>
            <Ionicons name="settings" size={20} color="#BB86FC" />
            <Text style={styles.actionText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="danger"
            size="medium"
            icon={<Ionicons name="log-out" size={20} color="#FFFFFF" />}
            iconPosition="left"
            style={styles.signOutButton}
          />
        </View>
      </ScrollView>

      {/* Admin Mode Password Dialog */}
      {showPasswordDialog && (
        <View style={styles.passwordDialogOverlay}>
          <View style={styles.passwordDialog}>
            <View style={styles.passwordDialogHeader}>
              <Ionicons name="lock-closed" size={32} color="#BB86FC" />
              <Text style={styles.passwordDialogTitle}>Admin Mode</Text>
              <Text style={styles.passwordDialogSubtitle}>Enter password to access</Text>
            </View>
            
            <View style={styles.passwordDialogContent}>
              <TextInput
                style={styles.passwordDialogInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter admin password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#666"
              />
              {passwordError ? (
                <Text style={styles.passwordDialogError}>{passwordError}</Text>
              ) : null}
            </View>
            
            <View style={styles.passwordDialogButtons}>
              <Button
                title="Cancel"
                onPress={handlePasswordDialogCancel}
                variant="secondary"
                size="medium"
                style={styles.passwordDialogCancelButton}
              />
              <Button
                title="Enter"
                onPress={handlePasswordVerification}
                variant="primary"
                size="medium"
                style={styles.passwordDialogSubmitButton}
              />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  loadingText: {
    color: '#BBBBBB',
    fontSize: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#BB86FC',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#BBBBBB',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  infoLabel: {
    fontSize: 16,
    color: '#BBBBBB',
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  // Password dialog styles
  passwordDialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  passwordDialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#333333',
  },
  passwordDialogHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  passwordDialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  passwordDialogSubtitle: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
  },
  passwordDialogContent: {
    marginBottom: 8,
  },
  passwordDialogInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  passwordDialogError: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  passwordDialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  passwordDialogCancelButton: {
    flex: 1,
  },
  passwordDialogSubmitButton: {
    flex: 1,
  },
  signOutButton: {
    marginTop: 8,
  },
});

export default ProfileScreen;
