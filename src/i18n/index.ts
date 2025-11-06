import en from './translations/en';
import es from './translations/es';
import pt from './translations/pt';

export type Language = 'en' | 'es' | 'pt';

export const translations = {
  en,
  es,
  pt,
};

export type TranslationKey = string;

export const getTranslation = (language: Language, key: string): string => {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const fallbackKey of keys) {
        if (value && typeof value === 'object' && fallbackKey in value) {
          value = value[fallbackKey];
        } else {
          return key; // Return key if translation not found
        }
      }
      return key;
    }
  }
  
  return typeof value === 'string' ? value : key;
};

