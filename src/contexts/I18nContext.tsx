import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Language, getTranslation } from '../i18n';
import AuthService from '../services/authService';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const authService = AuthService.getInstance();

  // Load language from user preferences
  useEffect(() => {
    const loadLanguage = () => {
      const user = authService.getCurrentUser();
      const userLanguage = user?.preferences?.language;
      console.log('[I18nContext] Loading language from user preferences:', userLanguage);
      
      if (userLanguage && (userLanguage === 'en' || userLanguage === 'es' || userLanguage === 'pt')) {
        setLanguageState(userLanguage as Language);
        console.log('[I18nContext] Language set to:', userLanguage);
      } else {
        setLanguageState('en'); // Default to English
        console.log('[I18nContext] Language defaulted to: en');
      }
    };

    loadLanguage();

    // Listen for auth state changes to update language when user logs in/out
    const unsubscribe = authService.onAuthStateChange((user) => {
      const userLanguage = user?.preferences?.language;
      console.log('[I18nContext] Auth state changed, user language:', userLanguage);
      if (userLanguage && (userLanguage === 'en' || userLanguage === 'es' || userLanguage === 'pt')) {
        setLanguageState(userLanguage as Language);
        console.log('[I18nContext] Language updated from auth state to:', userLanguage);
      } else {
        setLanguageState('en');
        console.log('[I18nContext] Language defaulted to: en');
      }
    });

    return unsubscribe;
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    console.log('[I18nContext] Setting language to:', lang);
    // Update state immediately for instant UI feedback
    setLanguageState(lang);
    
    // Update user preferences in Firebase
    const user = authService.getCurrentUser();
    if (user && user.preferences) {
      try {
        await authService.updateProfile({ 
          preferences: { ...user.preferences, language: lang } 
        });
        console.log('[I18nContext] Language preference saved to Firebase');
        // The notifyAuthStateListeners in updateProfile will trigger the useEffect
        // which will update the language state again, but that's fine since it's the same value
      } catch (error) {
        console.error('[I18nContext] Error updating language preference:', error);
        // Revert on error
        const currentUser = authService.getCurrentUser();
        const userLanguage = currentUser?.preferences?.language;
        if (userLanguage && (userLanguage === 'en' || userLanguage === 'es' || userLanguage === 'pt')) {
          setLanguageState(userLanguage as Language);
        } else {
          setLanguageState('en');
        }
      }
    } else {
      console.warn('[I18nContext] No user or preferences found, cannot save language');
    }
  }, []);

  const t = useCallback((key: string): string => {
    const translation = getTranslation(language, key);
    // Only log if translation is missing (returns the key)
    if (translation === key && !key.includes('.')) {
      console.warn(`[I18nContext] Missing translation for key: ${key} (language: ${language})`);
    }
    return translation;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

