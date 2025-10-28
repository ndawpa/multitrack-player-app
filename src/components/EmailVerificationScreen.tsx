import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { User } from '../types/user';
import Header from './Header';
import Button from './Button';

interface EmailVerificationScreenProps {
  user: User;
  onVerificationComplete: () => void;
  onBackToAuth: () => void;
}

const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  user,
  onVerificationComplete,
  onBackToAuth
}) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const authService = AuthService.getInstance();

  // Handle deep links for email verification
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (url.includes('mode=verifyEmail')) {
        // Extract the verification code from the URL
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const code = urlParams.get('oobCode');
        if (code) {
          await handleEmailVerification(code);
        }
      }
    };

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const linkingListener = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      linkingListener?.remove();
    };
  }, []);

  const handleEmailVerification = async (code: string) => {
    setLoading(true);
    try {
      await authService.verifyEmail(code);
      Alert.alert(
        'Email Verified!',
        'Your email has been successfully verified. You can now sign in to your account.',
        [{ text: 'OK', onPress: onVerificationComplete }]
      );
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Failed to verify email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    try {
      await authService.sendEmailVerification();
      Alert.alert(
        'Verification Email Sent',
        'A new verification email has been sent to your email address.'
      );
      setResendCooldown(60); // 60 second cooldown
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);


  return (
    <SafeAreaView style={styles.container}>
      <Header title="Email Verification" onBack={onBackToAuth} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.emailIcon}>✉️</Text>
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        
        <Text style={styles.description}>
          We've sent a verification link to:
        </Text>
        
        <Text style={styles.email}>{user.email}</Text>
        
        <Text style={styles.instructions}>
          Please check your email and click the verification link to activate your account.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
            onPress={handleResendVerification}
            disabled={resendLoading || resendCooldown > 0}
            loading={resendLoading}
            variant="secondary"
            size="large"
            style={styles.resendButton}
          />

          <Button
            title="Back to Sign In"
            onPress={onBackToAuth}
            disabled={loading}
            variant="tertiary"
            size="large"
            style={styles.backButton}
          />
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BB86FC" />
            <Text style={styles.loadingText}>Verifying email...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  emailIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#BB86FC',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BB86FC',
    textAlign: 'center',
    marginBottom: 24,
  },
  instructions: {
    fontSize: 14,
    color: '#BBBBBB',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  buttonContainer: {
    gap: 12,
  },
  resendButton: {
    marginBottom: 12,
  },
  backButton: {
    marginTop: 0,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#BBBBBB',
    marginTop: 8,
  },
});

export default EmailVerificationScreen;
