import { faGhost } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MantineThemeOverride } from '@mantine/core';
import { Extension, ExtensionContext } from 'shared';
import { brandEnglishStrings } from './branding.ts';
import { registerNavigation } from './navigation.ts';
import ConfigurationPage from './pages/configuration/ConfigurationPage.tsx';
import { hallowTheme } from './theme.ts';

class HallowExtension extends Extension {
  // Admin > Extensions > Hallow: the control plane URL and token (also on Network settings).
  public cardConfigurationPage: React.FC | null = ConfigurationPage;
  public cardComponent: React.FC | null = null;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.permissionIcons.addAdminPermissionIcon('hallow', <FontAwesomeIcon icon={faGhost} />);
    ctx.extensionRegistry.enterRoutes(registerNavigation);
    brandEnglishStrings();
  }

  public initializeMantineTheme(_ctx: ExtensionContext): MantineThemeOverride {
    return hallowTheme;
  }
}

export default new HallowExtension();
