import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthService from '../services/authService';
import { LoginForm, SignupForm } from '../types/user';
import Button from './Button';

interface AuthScreenProps {
  onAuthSuccess: () => void;
  onForgotPassword: () => void;
  onEmailVerificationNeeded: (user: any) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onForgotPassword, onEmailVerificationNeeded }) => {
  const insets = useSafeAreaInsets();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
  });
  
  const [signupForm, setSignupForm] = useState<SignupForm>({
    email: '',
    password: '',
    displayName: '',
  });

  const authService = AuthService.getInstance();

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(loginForm);
      onAuthSuccess();
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupForm.email || !signupForm.password || !signupForm.displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (signupForm.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.signUp(signupForm);
      if (result.needsVerification) {
        onEmailVerificationNeeded(result.user);
      } else {
        onAuthSuccess();
      }
    } catch (error: any) {
      Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setLoginForm({ email: '', password: '' });
    setSignupForm({ email: '', password: '', displayName: '' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Kit de Voz</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </Text>
        </View>

        <View style={[styles.form, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={signupForm.displayName}
                onChangeText={(text) => setSignupForm({ ...signupForm, displayName: text })}
                placeholder="Enter your name"
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={isLogin ? loginForm.email : signupForm.email}
              onChangeText={(text) => 
                isLogin 
                  ? setLoginForm({ ...loginForm, email: text })
                  : setSignupForm({ ...signupForm, email: text })
              }
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={isLogin ? loginForm.password : signupForm.password}
                onChangeText={(text) => 
                  isLogin 
                    ? setLoginForm({ ...loginForm, password: text })
                    : setSignupForm({ ...signupForm, password: text })
                }
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {isLogin && (
            <Button
              title="Forgot Password?"
              onPress={onForgotPassword}
              variant="tertiary"
              size="small"
              style={styles.forgotPasswordButton}
            />
          )}

          <Button
            title={isLogin ? 'Sign In' : 'Sign Up'}
            onPress={isLogin ? handleLogin : handleSignup}
            loading={loading}
            variant="primary"
            size="large"
            style={styles.primaryButton}
          />

          <Button
            title={isLogin 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"
            }
            onPress={toggleAuthMode}
            variant="tertiary"
            size="medium"
            style={styles.toggleButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#BBBBBB',
  },
  form: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    marginTop: 20,
  },
  toggleButton: {
    marginTop: 20,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
});

export default AuthScreen;
