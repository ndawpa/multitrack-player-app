import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AuthService from '../services/authService';
import AuthScreen from '../components/AuthScreen';
import ProfileScreen from '../components/ProfileScreen';
import SettingsScreen from '../components/SettingsScreen';
import HomePage from './HomePage';
import { User } from '../types/user';

type AppScreen = 'auth' | 'main' | 'profile' | 'settings';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('auth');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleBackToMain = () => {
    setCurrentScreen('main');
  };

  const handleBackToProfile = () => {
    setCurrentScreen('profile');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  switch (currentScreen) {
    case 'auth':
      return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
    
    case 'profile':
      return (
        <ProfileScreen 
          onNavigateToSettings={handleNavigateToSettings}
          onBack={handleBackToMain}
          onSignOut={handleSignOut}
        />
      );
    
    case 'settings':
      return (
        <SettingsScreen 
          onBack={handleBackToProfile}
        />
      );
    
    case 'main':
    default:
      return (
        <HomePage 
          onNavigateToProfile={handleNavigateToProfile}
          user={user}
        />
      );
  }
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