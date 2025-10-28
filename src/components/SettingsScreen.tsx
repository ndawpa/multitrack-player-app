import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { User, UserPreferences } from '../types/user';
import Header from './Header';

/**
 * SettingsScreen - Enhanced with improved error handling
 * 
 * Features:
 * - Persistent error banners for non-blocking error messages
 * - Real-time validation for display name input
 * - Better error messages with specific Firebase error codes
 * - Loading states and visual feedback
 * - Animated error banners that can be dismissed
 */

interface SettingsScreenProps {
  onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [errorBanner, setErrorBanner] = useState<{
    visible: boolean;
    message: string;
    type: 'displayName' | 'preferences';
  }>({ visible: false, message: '', type: 'displayName' });
  const [displayNameError, setDisplayNameError] = useState<string>('');

  const authService = AuthService.getInstance();
  const bannerAnimation = new Animated.Value(0);

  // Show error banner with animation
  const showErrorBanner = (message: string, type: 'displayName' | 'preferences') => {
    setErrorBanner({ visible: true, message, type });
    Animated.timing(bannerAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Hide error banner with animation
  const hideErrorBanner = () => {
    Animated.timing(bannerAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setErrorBanner({ visible: false, message: '', type: 'displayName' });
    });
  };

  // Validate display name
  const validateDisplayName = (name: string): string => {
    if (!name.trim()) {
      return 'Display name cannot be empty';
    }
    if (name.trim().length < 2) {
      return 'Display name must be at least 2 characters';
    }
    if (name.trim().length > 50) {
      return 'Display name must be less than 50 characters';
    }
    return '';
  };

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    setPreferences(currentUser?.preferences || null);
    setNewDisplayName(currentUser?.displayName || '');
    setLoading(false);

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      setPreferences(user?.preferences || null);
      setNewDisplayName(user?.displayName || '');
    });

    return unsubscribe;
  }, []);

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!user || !preferences) return;

    setSaving(true);
    // Hide any existing error banner
    if (errorBanner.visible && errorBanner.type === 'preferences') {
      hideErrorBanner();
    }
    
    try {
      const updatedPreferences = { ...preferences, [key]: value };
      await authService.updateProfile({ preferences: updatedPreferences });
      setPreferences(updatedPreferences);
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      let errorMessage = 'Failed to update preferences';
      
      // Provide more specific error messages
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showErrorBanner(`Error updating profile: ${errorMessage}`, 'preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleDisplayNameSave = async () => {
    if (!user) return;

    // Clear previous errors
    setDisplayNameError('');
    if (errorBanner.visible && errorBanner.type === 'displayName') {
      hideErrorBanner();
    }

    // Validate display name
    const validationError = validateDisplayName(newDisplayName);
    if (validationError) {
      setDisplayNameError(validationError);
      return;
    }

    setSaving(true);
    try {
      await authService.updateProfile({ displayName: newDisplayName.trim() });
      setEditingName(false);
    } catch (error: any) {
      console.error('Error updating display name:', error);
      let errorMessage = 'Failed to update display name';
      
      // Provide more specific error messages
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.code === 'auth/invalid-display-name') {
        errorMessage = 'Invalid display name format.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDisplayNameCancel = () => {
    setNewDisplayName(user?.displayName || '');
    setEditingName(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !preferences) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" onBack={onBack} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#BB86FC" />
            <Text style={styles.sectionTitle}>Profile</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Display Name</Text>
            {editingName ? (
              <View>
                <View style={styles.editContainer}>
                  <TextInput
                    style={[
                      styles.textInput,
                      displayNameError && styles.textInputError
                    ]}
                    value={newDisplayName}
                    onChangeText={(text) => {
                      setNewDisplayName(text);
                      if (displayNameError) {
                        setDisplayNameError('');
                      }
                    }}
                    placeholder="Enter display name"
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity 
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled
                    ]} 
                    onPress={handleDisplayNameSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Ionicons name="time-outline" size={24} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.cancelButton} 
                    onPress={handleDisplayNameCancel}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                {displayNameError ? (
                  <Text style={styles.errorText}>{displayNameError}</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.valueContainer}
                onPress={() => setEditingName(true)}
              >
                <Text style={styles.settingValue}>{user.displayName}</Text>
                <Ionicons name="create-outline" size={16} color="#BB86FC" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color="#BB86FC" />
            <Text style={styles.sectionTitle}>Appearance</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Theme</Text>
            <View style={styles.themeOptions}>
              {(['light', 'dark', 'auto'] as const).map((theme) => (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeOption,
                    preferences.theme === theme && styles.themeOptionSelected
                  ]}
                  onPress={() => handlePreferenceChange('theme', theme)}
                >
                  <Text style={[
                    styles.themeOptionText,
                    preferences.theme === theme && styles.themeOptionTextSelected
                  ]}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Audio Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="volume-high-outline" size={20} color="#BB86FC" />
            <Text style={styles.sectionTitle}>Audio</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Default Playback Speed</Text>
            <View style={styles.speedOptions}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedOption,
                    preferences.defaultPlaybackSpeed === speed && styles.speedOptionSelected
                  ]}
                  onPress={() => handlePreferenceChange('defaultPlaybackSpeed', speed)}
                >
                  <Text style={[
                    styles.speedOptionText,
                    preferences.defaultPlaybackSpeed === speed && styles.speedOptionTextSelected
                  ]}>
                    {speed}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.switchContainer}>
              <View>
                <Text style={styles.settingLabel}>Auto-play</Text>
                <Text style={styles.settingDescription}>
                  Automatically start playing when selecting a song
                </Text>
              </View>
              <Switch
                value={preferences.autoPlay}
                onValueChange={(value) => handlePreferenceChange('autoPlay', value)}
                trackColor={{ false: '#333', true: '#BB86FC' }}
                thumbColor={preferences.autoPlay ? '#FFFFFF' : '#BBBBBB'}
              />
            </View>
            {errorBanner.visible && errorBanner.type === 'preferences' && (
              <Animated.View 
                style={[
                  styles.errorBanner,
                  {
                    opacity: bannerAnimation,
                    transform: [{
                      translateY: bannerAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0]
                      })
                    }]
                  }
                ]}
              >
                <View style={styles.errorBannerContent}>
                  <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                  <Text style={styles.errorBannerText}>{errorBanner.message}</Text>
                  <TouchableOpacity onPress={hideErrorBanner} style={styles.errorBannerClose}>
                    <Ionicons name="close-outline" size={16} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color="#BB86FC" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.switchContainer}>
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive notifications for session invites and updates
                </Text>
              </View>
              <Switch
                value={preferences.notifications}
                onValueChange={(value) => handlePreferenceChange('notifications', value)}
                trackColor={{ false: '#333', true: '#BB86FC' }}
                thumbColor={preferences.notifications ? '#FFFFFF' : '#BBBBBB'}
              />
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="language-outline" size={20} color="#BB86FC" />
            <Text style={styles.sectionTitle}>Language</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Language</Text>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', name: 'English' },
                { code: 'es', name: 'Español' },
                { code: 'pt', name: 'Português' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    preferences.language === lang.code && styles.languageOptionSelected
                  ]}
                  onPress={() => handlePreferenceChange('language', lang.code)}
                >
                  <Text style={[
                    styles.languageOptionText,
                    preferences.language === lang.code && styles.languageOptionTextSelected
                  ]}>
                    {lang.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#BBBBBB',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 8,
  },
  textInputError: {
    borderColor: '#FF6B6B',
    borderWidth: 1,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  errorBanner: {
    marginTop: 12,
    backgroundColor: '#2D1B1B',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  errorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  errorBannerText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 14,
    marginLeft: 8,
  },
  errorBannerClose: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  settingItem: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 4,
  },
  settingValue: {
    fontSize: 16,
    color: '#BB86FC',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#BB86FC',
    borderRadius: 6,
    padding: 10,
    marginRight: 8,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 6,
    padding: 10,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333333',
  },
  themeOptionSelected: {
    backgroundColor: '#BB86FC',
  },
  themeOptionText: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  themeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  speedOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speedOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#333333',
  },
  speedOptionSelected: {
    backgroundColor: '#BB86FC',
  },
  speedOptionText: {
    color: '#BBBBBB',
    fontSize: 12,
  },
  speedOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333333',
  },
  languageOptionSelected: {
    backgroundColor: '#BB86FC',
  },
  languageOptionText: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  languageOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default SettingsScreen;
