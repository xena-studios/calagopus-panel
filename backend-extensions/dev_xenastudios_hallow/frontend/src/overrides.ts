// Core modules this extension replaces at build time. The panel's `extension-overrides` Vite
// plugin reads the `defineOverride(original, replacement)` calls here (it matches the call by
// name and resolves both imports), so this file is never imported at runtime.
import type { OverrideEntry } from 'shared';
import CoreAppIcon from '@/elements/AppIcon.tsx';
import CoreCopyright from '@/elements/Copyright.tsx';
import { steps as coreOobeSteps } from '@/routers/oobeSteps.ts';
import HallowAppIcon from './overrides/AppIcon.tsx';
import HallowCopyright from './overrides/Copyright.tsx';
import { steps as hallowOobeSteps } from './overrides/oobe/oobeSteps.ts';

function defineOverride<T>(original: T, replacement: NoInfer<T>): OverrideEntry {
  return { original, replacement };
}

export const overrides: OverrideEntry[] = [
  // Sidebar and setup header: logo, name and tagline.
  defineOverride(CoreAppIcon, HallowAppIcon),
  // Footer: the panel's name, with credit to Calagopus.
  defineOverride(CoreCopyright, HallowCopyright),
  // Setup wizard: account, panel settings, control plane, finish.
  defineOverride(coreOobeSteps, hallowOobeSteps),
];
