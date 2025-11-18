import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { User, UserPreferences } from '../types/user';
import Header from './Header';
import Button from './Button';
import { commonStyles, spacingStyles } from '../theme/layout';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';

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
  const { t, setLanguage } = useI18n();
  const toast = useToast();
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
      return t('settings.displayNameEmpty');
    }
    if (name.trim().length < 2) {
      return t('settings.displayNameMinLength');
    }
    if (name.trim().length > 50) {
      return t('settings.displayNameMaxLength');
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
      let errorMessage = t('settings.failedToUpdate');
      
      // Provide more specific error messages
      if (error.code === 'auth/network-request-failed') {
        errorMessage = t('settings.networkError');
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = t('settings.tooManyRequests');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showErrorBanner(`${t('settings.errorUpdatingProfile')}: ${errorMessage}`, 'preferences');
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
      let errorMessage = t('settings.failedToUpdateDisplayName');
      
      // Provide more specific error messages
      if (error.code === 'auth/network-request-failed') {
        errorMessage = t('settings.networkError');
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = t('settings.tooManyRequests');
      } else if (error.code === 'auth/invalid-display-name') {
        errorMessage = t('settings.invalidDisplayName');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.showError(t('common.error'), errorMessage);
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
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.loadingContainer}>
          <Text style={styles.loadingText}>{t('settings.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !preferences) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={commonStyles.errorContainer}>
          <Text style={styles.errorText}>{t('settings.failedToLoad')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleLanguageChange = async (langCode: string) => {
    // Use setLanguage from I18nContext which handles both context update and Firebase save
    await setLanguage(langCode as 'en' | 'es' | 'pt');
    // Also update local preferences state for immediate UI update
    if (preferences) {
      setPreferences({ ...preferences, language: langCode });
    }
  };

  return (
    <SafeAreaView style={commonStyles.container}>
      <Header title={t('settings.title')} onBack={onBack} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
      >
        {/* Profile Section */}
        <View style={commonStyles.section}>
          <View style={commonStyles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#BB86FC" />
            <Text style={commonStyles.sectionTitle}>{t('settings.profile')}</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('settings.displayName')}</Text>
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
                    placeholder={t('settings.enterDisplayName')}
                    placeholderTextColor="#666"
                  />
                  <Button
                    title=""
                    onPress={handleDisplayNameSave}
                    loading={saving}
                    variant="primary"
                    size="small"
                    icon={saving ? undefined : <Ionicons name="checkmark" size={24} color="#FFFFFF" />}
                    style={saving ? styles.saveButtonDisabled : styles.saveButton}
                  />
                  <Button
                    title=""
                    onPress={handleDisplayNameCancel}
                    variant="danger"
                    size="small"
                    icon={<Ionicons name="close" size={24} color="#FFFFFF" />}
                    style={styles.cancelButton}
                  />
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
        <View style={commonStyles.section}>
          <View style={commonStyles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={20} color="#BB86FC" />
            <Text style={commonStyles.sectionTitle}>{t('settings.appearance')}</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('settings.theme')}</Text>
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
                    {t(`settings.${theme}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Audio Section */}
        <View style={commonStyles.section}>
          <View style={commonStyles.sectionHeader}>
            <Ionicons name="volume-high-outline" size={20} color="#BB86FC" />
            <Text style={commonStyles.sectionTitle}>{t('settings.audio')}</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('settings.defaultPlaybackSpeed')}</Text>
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
                <Text style={styles.settingLabel}>{t('settings.autoPlay')}</Text>
                <Text style={styles.settingDescription}>
                  {t('settings.autoPlayDescription')}
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

        {/* Song View Section */}
        <View style={commonStyles.section}>
          <View style={commonStyles.sectionHeader}>
            <Ionicons name="musical-notes-outline" size={20} color="#BB86FC" />
            <Text style={commonStyles.sectionTitle}>{t('settings.songView')}</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('settings.defaultTab')}</Text>
            <Text style={styles.settingDescription}>
              {t('settings.defaultTabDescription')}
            </Text>
            <View style={styles.tabOptions}>
              {[
                { value: 'lyrics', label: t('settings.tabLyrics') },
                { value: 'score', label: t('settings.tabScore') },
                { value: 'tracks', label: t('settings.tabTracks') },
                { value: 'resources', label: t('settings.tabResources') },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.value}
                  style={[
                    styles.tabOption,
                    preferences.defaultTab === tab.value && styles.tabOptionSelected
                  ]}
                  onPress={() => handlePreferenceChange('defaultTab', tab.value)}
                >
                  <Text style={[
                    styles.tabOptionText,
                    preferences.defaultTab === tab.value && styles.tabOptionTextSelected
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={commonStyles.section}>
          <View style={commonStyles.sectionHeader}>
            <Ionicons name="language-outline" size={20} color="#BB86FC" />
            <Text style={commonStyles.sectionTitle}>{t('settings.language')}</Text>
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>{t('settings.language')}</Text>
            <View style={styles.languageOptions}>
              {[
                { code: 'en', name: t('languages.en') },
                { code: 'es', name: t('languages.es') },
                { code: 'pt', name: t('languages.pt') },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    preferences.language === lang.code && styles.languageOptionSelected
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
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
  loadingText: {
    color: '#BBBBBB',
    fontSize: 16,
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
    marginRight: 8,
    minWidth: 36,
    minHeight: 36,
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
    marginRight: 8,
    minWidth: 36,
    minHeight: 36,
  },
  cancelButton: {
    minWidth: 36,
    minHeight: 36,
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
  tabOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tabOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333333',
  },
  tabOptionSelected: {
    backgroundColor: '#BB86FC',
  },
  tabOptionText: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  tabOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default SettingsScreen;
