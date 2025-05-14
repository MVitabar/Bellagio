"use client"

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useTranslation, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

// Import only Portuguese translations
import ptTranslations from './i18n/i18n-provider-pt';

// Configure i18next
i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: ptTranslations }
    },
    lng: 'pt', // default language
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false // react already escapes values
    }
  });

// Language Context
const LanguageContext = createContext<{
  language: string;
  changeLanguage: (lang: string) => void;
  setLanguage: (lang: string) => void;
}>({
  language: 'pt',
  changeLanguage: () => {},
  setLanguage: () => {}
});

// Language Provider Component
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState('pt');
  const [isInitialized, setIsInitialized] = useState(false);

  // Use effect to set initial language
  useEffect(() => {
    // Ensure this only runs on client-side
    if (typeof window !== 'undefined') {
      // Force language to Portuguese
      i18n.changeLanguage('pt');
      
      // Update local state
      setLanguageState('pt');
      setIsInitialized(true);
    }
  }, []);

  const changeLanguage = () => {
    // No-op since we only support Portuguese
  };

  const setLanguage = () => {
    // No-op since we only support Portuguese
  };

  // Only render children when initialized to prevent flickering
  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use the language context
export const useLanguage = () => useContext(LanguageContext);

// Hook to use translations
export const useI18n = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { language } = useLanguage();
  
  return {
    t,
    i18n: i18nInstance,
    language
  };
};

// Export i18n instance for direct use if needed
export { i18n };

// Optional: Wrapper hook for translations
export const useAppTranslation = () => {
  const { t } = useTranslation();
  return t;
};

// Safe translation method
export const safeTranslate = (
  t: (key: string, options?: any) => string, 
  key: string | null | undefined, 
  fallback?: string
): string => {
  if (!key) return fallback || 'Unknown';
  
  try {
    const translation = t(key);
    return translation || fallback || key;
  } catch (error) {
    console.error('CRITICAL: Translation error for key:', error);
    return fallback || key;
  }
};

export default LanguageProvider;
