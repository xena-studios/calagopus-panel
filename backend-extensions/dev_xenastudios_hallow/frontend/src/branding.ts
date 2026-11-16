import baseTranslations from '@/translations.ts';

// English strings that name Calagopus where the panel's users see them. The core's English
// strings live in one mapping the translation provider reads at render time, so they can be
// replaced here without editing the core. Other languages keep their own translations.
const ENGLISH: Record<string, string> = {
  'pages.oobe.welcome.title': 'Welcome to Hallow',
  'pages.oobe.welcome.subtitle': "Let's get your network's control panel up and running.",
  'pages.oobe.finished.subtitle': 'Your Hallow panel is ready to use',
  'pages.oobe.configuration.form.applicationNamePlaceholder': 'Hallow Panel',
};

export function brandEnglishStrings() {
  const mapping = baseTranslations.mapping as Record<string, string>;

  for (const [key, value] of Object.entries(ENGLISH)) {
    if (key in mapping) mapping[key] = value;
  }
}
