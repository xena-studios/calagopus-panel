// Query keys for this extension, namespaced so they never collide with the panel's own.
const base = ['extensions', 'dev.xenastudios.hallow'] as const;

export const hallowQueryKeys = {
  all: () => base,
  extensionSettings: () => [...base, 'settings'] as const,
  fleetSettings: () => [...base, 'fleet', 'settings'] as const,
  fleetSettingsHistory: () => [...base, 'fleet', 'settings', 'history'] as const,
  network: () => [...base, 'network'] as const,
  player: (name: string) => [...base, 'players', name.toLowerCase()] as const,
  punishments: (name: string) => [...base, 'punishments', name.toLowerCase()] as const,
  // Every list of punishments (history and search), to refresh after issuing or lifting one.
  punishmentsAll: () => [...base, 'punishments'] as const,
  punishmentSearch: (filters: object) => [...base, 'punishments', 'search', filters] as const,
  punishmentTemplates: () => [...base, 'punishment-templates'] as const,
  ranks: () => [...base, 'ranks'] as const,
  playerRanks: (name: string) => [...base, 'ranks', 'players', name.toLowerCase()] as const,
  signals: (name: string) => [...base, 'signals', name.toLowerCase()] as const,
};
