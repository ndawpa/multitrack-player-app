import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import AIAssistantService, { ChatMessage } from '../services/aiAssistantService';
import AIAssistantAccessService from '../services/aiAssistantAccessService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/user';
import { useToast } from '../contexts/ToastContext';

interface AIAssistantScreenProps {
  onBack: () => void;
  user: User | null;
  isAdminMode?: boolean;
}

const AI_ASSISTANT_API_KEY_KEY = 'ai_assistant_api_key';
const AI_ASSISTANT_PROVIDER_KEY = 'ai_assistant_provider';
const AI_ASSISTANT_MODEL_KEY = 'ai_assistant_model';

const AIAssistantScreen: React.FC<AIAssistantScreenProps> = ({ onBack, user, isAdminMode = false }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>('google');
  const [model, setModel] = useState('gemini-2.5-flash-lite');
  const [showSettings, setShowSettings] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const aiService = AIAssistantService.getInstance();
  const accessService = AIAssistantAccessService.getInstance();

  useEffect(() => {
    loadSettings();
    checkAccess();
    checkAdminStatus();
  }, [user, isAdminMode]);

  const checkAccess = async () => {
    if (user?.id) {
      try {
        const access = await accessService.checkUserAccess(user.id);
        setHasAccess(access);
        if (!access) {
          toast.showError(
            'Access Restricted',
            'You do not have access to the AI Assistant. Please contact your administrator if you believe this is an error.'
          );
          setTimeout(() => onBack(), 2000);
        }
      } catch (error) {
        console.error('Error checking AI Assistant access:', error);
        setHasAccess(false);
      }
    } else {
      setHasAccess(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      // Check both database role and admin mode
      const hasDbRole = await accessService.isAdmin();
      const isAdminUser = hasDbRole || isAdminMode;
      setIsAdmin(isAdminUser);
      console.log('Admin status check:', { hasDbRole, isAdminMode, isAdminUser });
    } catch (error) {
      console.error('Error checking admin status:', error);
      // Fallback to admin mode if available
      setIsAdmin(isAdminMode);
    }
  };

  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadSettings = async () => {
    try {
      // Load from Firebase (centralized config)
      await aiService.loadConfigFromFirebase();
      const aiConfig = await accessService.getAIConfig();

      console.log('Loading AI Assistant settings from Firebase:', {
        hasApiKey: !!aiConfig?.apiKey,
        apiKeyLength: aiConfig?.apiKey?.length || 0,
        provider: aiConfig?.provider,
        model: aiConfig?.model
      });

      if (aiConfig && aiConfig.apiKey) {
        setApiKey(aiConfig.apiKey);
        setProvider(aiConfig.provider || 'google');
        setModel(aiConfig.model || 'gemini-2.5-flash-lite');
        setIsConfigured(true);
        console.log('AI Assistant configured successfully from Firebase');
      } else {
        console.log('No API key found in Firebase');
        // Only show settings if user is admin
        const admin = await accessService.isAdmin();
        if (admin) {
          setShowSettings(true);
        } else {
          toast.showWarning(
            'Configuration Required',
            'The AI Assistant has not been configured yet. Please contact your administrator to set up the API key.'
          );
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!apiKey.trim()) {
      toast.showError('Error', 'Please enter an API key');
      return;
    }

    // Check if user is admin
    if (!isAdmin) {
      toast.showError('Permission Denied', 'Only administrators can configure the AI Assistant API key.');
      return;
    }

    try {
      const trimmedApiKey = apiKey.trim();
      console.log('Saving AI Assistant settings to Firebase:', {
        provider,
        model,
        apiKeyLength: trimmedApiKey.length,
        apiKeyPrefix: trimmedApiKey.substring(0, 7) + '...'
      });

      // Save to Firebase (allow admin mode users to save)
      await accessService.updateAIConfig({
        apiKey: trimmedApiKey,
        provider,
        model
      }, isAdminMode);
      
      // Configure the service
      aiService.configure({
        apiKey: trimmedApiKey,
        provider,
        model
      });
      
      setIsConfigured(true);
      setShowSettings(false);
      console.log('Settings saved and configured successfully');
      toast.showSuccess('Success', 'AI Assistant configured successfully! All users with access can now use it.');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.showError('Error', error.message || 'Failed to save settings');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    if (!hasAccess) {
      toast.showError(
        'Access Restricted',
        'You do not have access to the AI Assistant. Please contact your administrator.'
      );
      return;
    }

    if (!isConfigured) {
      toast.showWarning('Configuration Required', 'Please configure your AI API key in settings first.');
      setShowSettings(true);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      console.log('Sending question to AI:', inputText.trim());
      const response = await aiService.askQuestion(inputText.trim(), messages);
      console.log('Received response from AI');
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error getting AI response:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      let errorMessageText = `Sorry, I encountered an error: ${error.message || 'Unknown error'}.`;
      
      // Provide more helpful error messages
      if (error.message?.includes('Network')) {
        errorMessageText = 'Network error: Unable to connect to the AI service. Please check your internet connection and try again.';
      } else if (error.message?.includes('API key')) {
        errorMessageText = 'API key error: Please check your API key in settings. Make sure it\'s correct and has sufficient credits.';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessageText = 'Authentication error: Your API key is invalid. Please check your API key in settings.';
      } else if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessageText = 'Rate limit exceeded: You\'ve made too many requests. Please wait a moment and try again.';
      }
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: errorMessageText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSettings = () => (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>AI Assistant Configuration</Text>
      <Text style={styles.settingsDescription}>
        Configure your AI API key to enable the assistant. You can use OpenAI, Anthropic (Claude), or Google (Gemini).
      </Text>

      <Text style={styles.label}>Provider</Text>
      <View style={styles.providerButtons}>
        <TouchableOpacity
          style={[styles.providerButton, provider === 'openai' && styles.providerButtonActive]}
          onPress={() => setProvider('openai')}
        >
          <Text style={[styles.providerButtonText, provider === 'openai' && styles.providerButtonTextActive]}>
            OpenAI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.providerButton, provider === 'anthropic' && styles.providerButtonActive]}
          onPress={() => setProvider('anthropic')}
        >
          <Text style={[styles.providerButtonText, provider === 'anthropic' && styles.providerButtonTextActive]}>
            Anthropic
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.providerButton, provider === 'google' && styles.providerButtonActive]}
          onPress={() => setProvider('google')}
        >
          <Text style={[styles.providerButtonText, provider === 'google' && styles.providerButtonTextActive]}>
            Google
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Model</Text>
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="e.g., gemini-2.5-flash-lite, gemini-1.5-pro, gpt-4o-mini"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>API Key {isAdmin ? '(Admin Only)' : ''}</Text>
      {isAdmin ? (
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Enter your API key"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
        />
      ) : (
        <View style={styles.disabledInput}>
          <Text style={styles.disabledInputText}>
            Only administrators can configure the API key. Please contact your administrator.
          </Text>
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
          <Text style={styles.saveButtonText}>Save Configuration</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSettings(false)}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  if (showSettings) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => setShowSettings(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Assistant Settings</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.settingsScrollView}>
          {renderSettings()}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsButton}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeTitle}>🎵 AI Music Assistant</Text>
              <Text style={styles.welcomeText}>
                Ask me anything about your music library! I can help you:
              </Text>
              <Text style={styles.welcomeBullet}>• Find songs by theme or topic</Text>
              <Text style={styles.welcomeBullet}>• Search lyrics for specific content</Text>
              <Text style={styles.welcomeBullet}>• Get insights about your songs</Text>
              <Text style={styles.welcomeBullet}>• Discover songs based on mood or theme</Text>
              <Text style={styles.exampleText}>
                Try asking: "Find songs about love" or "What songs mention the word 'dream'?"
              </Text>
            </View>
          )}

          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.messageContainer,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage
              ]}
            >
              <Text style={[styles.messageRole, message.role === 'user' && styles.userMessageRole]}>
                {message.role === 'user' ? 'You' : 'Assistant'}
              </Text>
              {message.role === 'user' ? (
                <Text style={styles.userMessageText}>
                  {message.content}
                </Text>
              ) : (
                <Markdown style={markdownStyles}>
                  {message.content}
                </Markdown>
              )}
            </View>
          ))}

          {isLoading && (
            <View style={[styles.messageContainer, styles.assistantMessage]}>
              <Text style={styles.messageRole}>Assistant</Text>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#BB86FC" />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your songs..."
            placeholderTextColor="#888"
            multiline
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
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
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  backButton: {
    fontSize: 16,
    color: '#BB86FC',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsButton: {
    fontSize: 20,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  welcomeContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#FFFFFF',
  },
  welcomeText: {
    fontSize: 16,
    color: '#BBBBBB',
    marginBottom: 12,
  },
  welcomeBullet: {
    fontSize: 14,
    color: '#BBBBBB',
    marginBottom: 8,
    paddingLeft: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#BB86FC',
    marginTop: 12,
    fontStyle: 'italic',
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#BB86FC',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#1E1E1E',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#BBBBBB',
  },
  userMessageRole: {
    color: '#fff',
    opacity: 0.9,
  },
  messageText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  userMessageText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#BBBBBB',
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    backgroundColor: '#121212',
    color: '#FFFFFF',
  },
  sendButton: {
    backgroundColor: '#BB86FC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  settingsContainer: {
    padding: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  settingsDescription: {
    fontSize: 14,
    color: '#BBBBBB',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFFFFF',
  },
  providerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  providerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2C2C2C',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
  },
  providerButtonActive: {
    borderColor: '#BB86FC',
    backgroundColor: '#2C1E3E',
  },
  providerButtonText: {
    fontSize: 14,
    color: '#BBBBBB',
  },
  providerButtonTextActive: {
    color: '#BB86FC',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#121212',
    color: '#FFFFFF',
  },
  disabledInput: {
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#121212',
    opacity: 0.6,
  },
  disabledInputText: {
    color: '#BBBBBB',
    fontSize: 14,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#BB86FC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    backgroundColor: '#1E1E1E',
  },
  cancelButtonText: {
    color: '#BBBBBB',
    fontSize: 16,
  },
  settingsScrollView: {
    flex: 1,
  },
});

// Markdown styles for dark theme
const markdownStyles = StyleSheet.create({
  body: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  heading1: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  heading2: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  heading3: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  heading4: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 4,
  },
  heading5: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  heading6: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  strong: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  code_inline: {
    backgroundColor: '#2C2C2C',
    color: '#BB86FC',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  code_block: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  list_item: {
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
  link: {
    color: '#BB86FC',
    textDecorationLine: 'underline',
  },
  blockquote: {
    backgroundColor: '#1E1E1E',
    borderLeftWidth: 4,
    borderLeftColor: '#BB86FC',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    paddingRight: 12,
  },
  hr: {
    backgroundColor: '#2C2C2C',
    height: 1,
    marginVertical: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 8,
    marginVertical: 8,
  },
  thead: {
    backgroundColor: '#1E1E1E',
  },
  th: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  td: {
    color: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
});

export default AIAssistantScreen;

