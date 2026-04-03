import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import fr from './locales/fr.json';

const resources = {
  en: {
    translation: en
  },
  fr: {
    translation: fr
  }
};

// Get saved language from localStorage or default to 'fr'
const savedLanguage = localStorage.getItem('language') || 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage, // use saved language or default to French
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false // React already does escaping
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;