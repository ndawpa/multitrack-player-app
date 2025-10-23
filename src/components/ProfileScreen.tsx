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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthService from '../services/authService';
import { User } from '../types/user';

interface ProfileScreenProps {
  onNavigateToSettings: () => void;
  onSignOut: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ 
  onNavigateToSettings, 
  onSignOut 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const authService = AuthService.getInstance();

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !user.stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Your Stats</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Account Info</Text>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToSettings}>
            <Ionicons name="settings" size={20} color="#BB86FC" />
            <Text style={styles.actionText}>Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
            <Ionicons name="log-out" size={20} color="#FF6B6B" />
            <Text style={[styles.actionText, { color: '#FF6B6B' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
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
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
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
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
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
});

export default ProfileScreen;
