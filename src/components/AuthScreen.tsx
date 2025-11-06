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
import { useI18n } from '../contexts/I18nContext';

interface AuthScreenProps {
  onAuthSuccess: () => void;
  onForgotPassword: () => void;
  onEmailVerificationNeeded: (user: any) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onForgotPassword, onEmailVerificationNeeded }) => {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(loginForm);
      onAuthSuccess();
    } catch (error: any) {
      Alert.alert(t('auth.loginFailed'), error.message || t('auth.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupForm.email || !signupForm.password || !signupForm.displayName) {
      Alert.alert(t('auth.error'), t('auth.fillAllFields'));
      return;
    }

    if (signupForm.password.length < 6) {
      Alert.alert(t('auth.error'), t('auth.passwordMinLength'));
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
      Alert.alert(t('auth.signupFailed'), error.message || t('auth.errorOccurred'));
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
          <Text style={styles.title}>{t('appName')}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </Text>
        </View>

        <View style={[styles.form, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('auth.displayName')}</Text>
              <TextInput
                style={styles.input}
                value={signupForm.displayName}
                onChangeText={(text) => setSignupForm({ ...signupForm, displayName: text })}
                placeholder={t('auth.enterName')}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={isLogin ? loginForm.email : signupForm.email}
              onChangeText={(text) => 
                isLogin 
                  ? setLoginForm({ ...loginForm, email: text })
                  : setSignupForm({ ...signupForm, email: text })
              }
              placeholder={t('auth.enterEmail')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.password')}</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={isLogin ? loginForm.password : signupForm.password}
                onChangeText={(text) => 
                  isLogin 
                    ? setLoginForm({ ...loginForm, password: text })
                    : setSignupForm({ ...signupForm, password: text })
                }
                placeholder={t('auth.enterPassword')}
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
              title={t('auth.forgotPassword')}
              onPress={onForgotPassword}
              variant="tertiary"
              size="small"
              style={styles.forgotPasswordButton}
            />
          )}

          <Button
            title={isLogin ? t('auth.signIn') : t('auth.signUp')}
            onPress={isLogin ? handleLogin : handleSignup}
            loading={loading}
            variant="primary"
            size="large"
            style={styles.primaryButton}
          />

          <Button
            title={isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
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
