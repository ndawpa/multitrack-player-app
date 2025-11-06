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
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AIAssistantService, { ChatMessage } from '../services/aiAssistantService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/user';

interface AIAssistantScreenProps {
  onBack: () => void;
  user: User | null;
}

const AI_ASSISTANT_API_KEY_KEY = 'ai_assistant_api_key';
const AI_ASSISTANT_PROVIDER_KEY = 'ai_assistant_provider';
const AI_ASSISTANT_MODEL_KEY = 'ai_assistant_model';

const AIAssistantScreen: React.FC<AIAssistantScreenProps> = ({ onBack, user }) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [showSettings, setShowSettings] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const aiService = AIAssistantService.getInstance();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadSettings = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem(AI_ASSISTANT_API_KEY_KEY);
      const savedProvider = await AsyncStorage.getItem(AI_ASSISTANT_PROVIDER_KEY) as 'openai' | 'anthropic' | 'google' | null;
      const savedModel = await AsyncStorage.getItem(AI_ASSISTANT_MODEL_KEY);

      console.log('Loading AI Assistant settings:', {
        hasApiKey: !!savedApiKey,
        apiKeyLength: savedApiKey?.length || 0,
        provider: savedProvider,
        model: savedModel
      });

      if (savedApiKey) {
        setApiKey(savedApiKey);
        setProvider(savedProvider || 'openai');
        setModel(savedModel || 'gpt-4o-mini');
        aiService.configure({
          apiKey: savedApiKey,
          provider: savedProvider || 'openai',
          model: savedModel || 'gpt-4o-mini'
        });
        setIsConfigured(true);
        console.log('AI Assistant configured successfully');
      } else {
        console.log('No API key found, showing settings');
        setShowSettings(true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    try {
      const trimmedApiKey = apiKey.trim();
      console.log('Saving AI Assistant settings:', {
        provider,
        model,
        apiKeyLength: trimmedApiKey.length,
        apiKeyPrefix: trimmedApiKey.substring(0, 7) + '...'
      });

      await AsyncStorage.setItem(AI_ASSISTANT_API_KEY_KEY, trimmedApiKey);
      await AsyncStorage.setItem(AI_ASSISTANT_PROVIDER_KEY, provider);
      await AsyncStorage.setItem(AI_ASSISTANT_MODEL_KEY, model);
      
      aiService.configure({
        apiKey: trimmedApiKey,
        provider,
        model
      });
      
      setIsConfigured(true);
      setShowSettings(false);
      console.log('Settings saved and configured successfully');
      Alert.alert('Success', 'AI Assistant configured successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    if (!isConfigured) {
      Alert.alert('Configuration Required', 'Please configure your AI API key in settings first.');
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
        placeholder="e.g., gpt-4o-mini, claude-3-haiku-20240307, gemini-pro"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>API Key</Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="Enter your API key"
        placeholderTextColor="#999"
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.saveButton} onPress={saveSettings}>
        <Text style={styles.saveButtonText}>Save Configuration</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSettings(false)}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  if (showSettings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSettings(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Assistant Settings</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.settingsScrollView}>
          {renderSettings()}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.settingsButton}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
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
            <Text style={message.role === 'user' ? styles.userMessageText : styles.messageText}>
              {message.content}
            </Text>
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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about your songs..."
          placeholderTextColor="#999"
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#BB86FC',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  welcomeBullet: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#666',
  },
  userMessageRole: {
    color: '#fff',
    opacity: 0.9,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
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
    color: '#666',
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
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
    color: '#000',
  },
  settingsDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
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
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  providerButtonActive: {
    borderColor: '#BB86FC',
    backgroundColor: '#2C1E3E',
  },
  providerButtonText: {
    fontSize: 14,
    color: '#666',
  },
  providerButtonTextActive: {
    color: '#BB86FC',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
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
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
  settingsScrollView: {
    flex: 1,
  },
});

export default AIAssistantScreen;

