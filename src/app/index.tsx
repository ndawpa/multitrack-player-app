import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AuthService from '../services/authService';
import AuthScreen from '../components/AuthScreen';
import PasswordResetScreen from '../components/PasswordResetScreen';
import NewPasswordScreen from '../components/NewPasswordScreen';
import ProfileScreen from '../components/ProfileScreen';
import SettingsScreen from '../components/SettingsScreen';
import EmailVerificationScreen from '../components/EmailVerificationScreen';
import PlaylistScreen from '../components/PlaylistScreen';
import AIAssistantScreen from '../components/AIAssistantScreen';
import HomePage from './HomePage';
import { User } from '../types/user';
import { Song } from '../types/song';
import { Playlist } from '../types/playlist';
import { I18nProvider } from '../contexts/I18nContext';

type AppScreen = 'auth' | 'main' | 'profile' | 'settings' | 'passwordReset' | 'newPassword' | 'emailVerification' | 'playlists' | 'aiAssistant';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetData, setResetData] = useState<{ code: string; email: string } | null>(null);
  const [verificationUser, setVerificationUser] = useState<User | null>(null);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [playlistToPlay, setPlaylistToPlay] = useState<{playlist: Playlist, songs: Song[]} | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const authService = AuthService.getInstance();

  useEffect(() => {
    console.log('App: Setting up auth listener');
    
    // Listen for authentication state changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      console.log('App: Auth state changed', { user: user ? 'logged in' : 'logged out' });
      setUser(user);
      if (user) {
        setCurrentScreen('main');
      } else {
        setCurrentScreen('auth');
      }
      setLoading(false);
    });

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('App: Loading timeout reached, showing auth screen');
      setLoading(false);
    }, 5000); // 5 second timeout

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleAuthSuccess = () => {
    setCurrentScreen('main');
  };

  const handleSignOut = () => {
    setCurrentScreen('auth');
  };

  const handleNavigateToProfile = () => {
    setCurrentScreen('profile');
  };

  const handleNavigateToSettings = () => {
    setCurrentScreen('settings');
  };


  const handleNavigateToPlaylists = (songs: Song[]) => {
    setAvailableSongs(songs);
    setCurrentScreen('playlists');
  };

  const handleNavigateToAIAssistant = () => {
    setCurrentScreen('aiAssistant');
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
  };

  const handleBackToProfile = () => {
    setCurrentScreen('profile');
  };

  const handleForgotPassword = () => {
    setCurrentScreen('passwordReset');
  };

  const handlePasswordResetSuccess = () => {
    setCurrentScreen('auth');
  };

  const handleBackFromPasswordReset = () => {
    setCurrentScreen('auth');
  };

  const handlePasswordResetFromLink = (code: string, email: string) => {
    setResetData({ code, email });
    setCurrentScreen('newPassword');
  };

  const handleNewPasswordSuccess = () => {
    setResetData(null);
    setCurrentScreen('auth');
  };

  const handleBackFromNewPassword = () => {
    setResetData(null);
    setCurrentScreen('auth');
  };

  const handleEmailVerificationNeeded = (user: User) => {
    setVerificationUser(user);
    setCurrentScreen('emailVerification');
  };

  const handleEmailVerificationComplete = () => {
    setVerificationUser(null);
    setCurrentScreen('auth');
  };

  const handleBackFromEmailVerification = () => {
    setVerificationUser(null);
    setCurrentScreen('auth');
  };

  const handleAdminModeChange = (isAdmin: boolean) => {
    setIsAdminMode(isAdmin);
    // Redirect to home page when entering admin mode
    if (isAdmin && currentScreen !== 'main') {
      setCurrentScreen('main');
    }
  };

  if (loading) {
    return (
      <I18nProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      {(() => {
        switch (currentScreen) {
    case 'auth':
      return (
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          onForgotPassword={handleForgotPassword}
          onEmailVerificationNeeded={handleEmailVerificationNeeded}
        />
      );
    
    case 'passwordReset':
      return (
        <PasswordResetScreen 
          onBack={handleBackFromPasswordReset}
          onSuccess={handlePasswordResetSuccess}
          onPasswordResetFromLink={handlePasswordResetFromLink}
        />
      );
    
    case 'newPassword':
      return resetData ? (
        <NewPasswordScreen 
          resetCode={resetData.code}
          email={resetData.email}
          onBack={handleBackFromNewPassword}
          onSuccess={handleNewPasswordSuccess}
        />
      ) : (
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          onForgotPassword={handleForgotPassword}
          onEmailVerificationNeeded={handleEmailVerificationNeeded}
        />
      );
    
    case 'emailVerification':
      return verificationUser ? (
        <EmailVerificationScreen
          user={verificationUser}
          onVerificationComplete={handleEmailVerificationComplete}
          onBackToAuth={handleBackFromEmailVerification}
        />
      ) : (
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          onForgotPassword={handleForgotPassword}
          onEmailVerificationNeeded={handleEmailVerificationNeeded}
        />
      );
    
    case 'profile':
      return (
        <ProfileScreen 
          onNavigateToSettings={handleNavigateToSettings}
          onBack={handleBackToMain}
          onSignOut={handleSignOut}
          isAdminMode={isAdminMode}
          onAdminModeChange={handleAdminModeChange}
        />
      );
    
    case 'settings':
      return (
        <SettingsScreen 
          onBack={handleBackToProfile}
        />
      );
    
    
    case 'playlists':
      return (
        <PlaylistScreen 
          onBack={handleBackToMain}
          onPlayPlaylist={(playlist, songs) => {
            // Store playlist data and navigate back to main
            setPlaylistToPlay({playlist, songs});
            setCurrentScreen('main');
          }}
          user={user}
          availableSongs={availableSongs}
        />
      );
    
    case 'aiAssistant':
      return (
        <AIAssistantScreen 
          onBack={handleBackToMain}
          user={user}
          isAdminMode={isAdminMode}
        />
      );
    
    case 'main':
    default:
      return (
        <HomePage 
          onNavigateToProfile={handleNavigateToProfile}
          onNavigateToPlaylists={handleNavigateToPlaylists}
          onNavigateToAIAssistant={handleNavigateToAIAssistant}
          user={user}
          playlistToPlay={playlistToPlay}
          onPlaylistPlayed={() => setPlaylistToPlay(null)}
          isAdminMode={isAdminMode}
          onAdminModeChange={handleAdminModeChange}
        />
      );
        }
      })()}
    </I18nProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#BBBBBB',
    fontSize: 16,
    marginTop: 16,
  },
});

export default App;