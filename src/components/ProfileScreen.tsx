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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import AIAssistantAccessService from '../services/aiAssistantAccessService';
import { User } from '../types/user';
import Header from './Header';
import Button from './Button';
import { commonStyles, spacingStyles } from '../theme/layout';
import { useI18n } from '../contexts/I18nContext';

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
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [hasAdminAccess, setHasAdminAccess] = useState(false);

  const authService = AuthService.getInstance();
  const accessService = AIAssistantAccessService.getInstance();
  const ADMIN_PASSWORD = 'admin123'; // You should change this to a more secure password

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Check if user has admin access
    const checkAdminAccess = async () => {
      try {
        const isAdmin = await accessService.isAdmin();
        setHasAdminAccess(isAdmin);
      } catch (error) {
        console.error('Error checking admin access:', error);
        setHasAdminAccess(false);
      }
    };

    checkAdminAccess();

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      // Re-check admin access when user changes
      checkAdminAccess();
    });

    return unsubscribe;
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('profile.signOut'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              onSignOut();
            } catch (error) {
              Alert.alert(t('common.error'), t('profile.signOutFailed'));
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
      setPasswordError(t('profile.incorrectPassword'));
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
          <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !user.stats) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.errorContainer}>
          <Text style={styles.errorText}>{t('profile.failedToLoad')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container}>
      <Header title={t('profile.title')} onBack={onBack} />
      
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
          <Text style={commonStyles.sectionTitle}>{t('profile.yourStats')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.totalSessions || 0}</Text>
              <Text style={styles.statLabel}>{t('profile.sessions')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatPlayTime(user.stats.totalPlayTime || 0)}</Text>
              <Text style={styles.statLabel}>{t('profile.playTime')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.favoriteArtists?.length || 0}</Text>
              <Text style={styles.statLabel}>{t('profile.favoriteArtists')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.stats.favoriteSongs?.length || 0}</Text>
              <Text style={styles.statLabel}>{t('profile.favoriteSongs')}</Text>
            </View>
          </View>
        </View>

        {/* Account Info */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>{t('profile.accountInfo')}</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('profile.memberSince')}</Text>
            <Text style={styles.infoValue}>{user.stats.joinedDate ? formatDate(user.stats.joinedDate) : t('profile.unknown')}</Text>
          </View>
          {user.stats.lastSessionDate && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('profile.lastSession')}</Text>
              <Text style={styles.infoValue}>{formatDate(user.stats.lastSessionDate)}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={commonStyles.section}>
          <Text style={commonStyles.sectionTitle}>{t('profile.quickActions')}</Text>
          
          {hasAdminAccess && (
            <TouchableOpacity style={styles.actionButton} onPress={handleAdminModeToggle}>
              <Ionicons 
                name={isAdminMode ? "shield-checkmark" : "shield"} 
                size={20} 
                color={isAdminMode ? "#4CAF50" : "#BB86FC"} 
              />
              <Text style={[styles.actionText, isAdminMode && { color: '#4CAF50' }]}>
                {isAdminMode ? t('profile.adminModeActive') : t('profile.adminMode')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToSettings}>
            <Ionicons name="settings" size={20} color="#BB86FC" />
            <Text style={styles.actionText}>{t('profile.settings')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <Button
            title={t('profile.signOut')}
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
        <KeyboardAvoidingView 
          style={styles.passwordDialogOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.passwordDialog}>
            <View style={styles.passwordDialogHeader}>
              <Ionicons name="lock-closed" size={32} color="#BB86FC" />
              <Text style={styles.passwordDialogTitle}>{t('profile.adminMode')}</Text>
              <Text style={styles.passwordDialogSubtitle}>{t('profile.enterPassword')}</Text>
            </View>
            
            <View style={styles.passwordDialogContent}>
              <TextInput
                style={styles.passwordDialogInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('profile.enterAdminPassword')}
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
                title={t('common.cancel')}
                onPress={handlePasswordDialogCancel}
                variant="secondary"
                size="medium"
                style={styles.passwordDialogCancelButton}
              />
              <Button
                title={t('profile.enter')}
                onPress={handlePasswordVerification}
                variant="primary"
                size="medium"
                style={styles.passwordDialogSubmitButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
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
