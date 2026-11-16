// Query keys for this extension, namespaced so they never collide with the panel's own.
const base = ['extensions', 'dev.xenastudios.hallow'] as const;

export const hallowQueryKeys = {
  extensionSettings: () => [...base, 'settings'] as const,
  fleetSettings: () => [...base, 'fleet', 'settings'] as const,
  fleetSettingsHistory: () => [...base, 'fleet', 'settings', 'history'] as const,
};
