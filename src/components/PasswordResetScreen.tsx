import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { PasswordResetForm } from '../types/user';
import Header from './Header';
import Button from './Button';

interface PasswordResetScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  onPasswordResetFromLink: (code: string, email: string) => void;
}

const PasswordResetScreen: React.FC<PasswordResetScreenProps> = ({ onBack, onSuccess, onPasswordResetFromLink }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'email' | 'instructions'>('email');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const [resetForm, setResetForm] = useState<PasswordResetForm>({
    email: '',
  });

  const authService = AuthService.getInstance();

  // Handle deep links for password reset
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('mode=resetPassword')) {
        // Extract the reset code from the URL
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const code = urlParams.get('oobCode');
        if (code) {
          handlePasswordResetFromLink(code);
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

  const handlePasswordResetFromLink = async (code: string) => {
    try {
      // Verify the code and get the email
      const email = await authService.verifyPasswordResetCode(code);
      onPasswordResetFromLink(code, email);
    } catch (error: any) {
      Alert.alert('Invalid Link', error.message || 'This reset link is invalid or has expired.');
    }
  };

  const handleSendResetEmail = async () => {
    if (!resetForm.email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await authService.sendPasswordResetEmail(resetForm.email);
      setEmailSent(true);
      setStep('instructions');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={step === 'email' ? 'Reset Password' : 'Check Your Email'} 
        onBack={onBack} 
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>

          <View style={styles.formContainer}>
            {step === 'email' ? (
              <>
                <Text style={styles.description}>
                  Enter your email address and we'll send you a password reset link.
                </Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    value={resetForm.email}
                    onChangeText={(text) => setResetForm({ ...resetForm, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Button
                  title="Send Reset Link"
                  onPress={handleSendResetEmail}
                  loading={loading}
                  variant="primary"
                  size="large"
                  style={styles.resetButton}
                />
              </>
            ) : (
              <>
                <View style={styles.successContainer}>
                  <Text style={styles.successIcon}>✉️</Text>
                  <Text style={styles.successTitle}>Check Your Email</Text>
                  <Text style={styles.successDescription}>
                    We've sent a password reset link to:
                  </Text>
                  <Text style={styles.emailText}>{resetForm.email}</Text>
                </View>


              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 30,
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 16,
  },
  eyeButtonText: {
    fontSize: 18,
  },
  resetButton: {
    marginTop: 10,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#BB86FC',
  },
});

export default PasswordResetScreen;
