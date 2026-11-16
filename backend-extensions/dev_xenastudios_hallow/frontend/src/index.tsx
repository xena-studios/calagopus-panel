import { faGhost, faNetworkWired, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MantineThemeOverride } from '@mantine/core';
import { Extension, ExtensionContext } from 'shared';
import ConfigurationPage from './pages/configuration/ConfigurationPage.tsx';
import FleetSettingsPage from './pages/fleet/FleetSettingsPage.tsx';
import NetworkPage from './pages/network/NetworkPage.tsx';
import { hallowOrange } from './theme.ts';

class HallowExtension extends Extension {
  // Admin > Extensions > Hallow: the control plane URL and token.
  public cardConfigurationPage: React.FC | null = ConfigurationPage;
  public cardComponent: React.FC | null = null;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.permissionIcons.addAdminPermissionIcon('hallow', <FontAwesomeIcon icon={faGhost} />);

    ctx.extensionRegistry.enterRoutes((routes) =>
      routes
        .addAdminRoute({
          name: 'Network',
          icon: faNetworkWired,
          path: '/hallow/network',
          element: NetworkPage,
          // The admin router already requires an admin. Hallow permissions
          // (`hallow.network.*`) come with the staff roles in #25.
          permission: null,
          category: 'infrastructure',
        })
        .addAdminRoute({
          name: 'Fleet settings',
          icon: faSliders,
          path: '/hallow/fleet',
          element: FleetSettingsPage,
          permission: 'hallow.fleet.read',
          category: 'infrastructure',
        }),
    );
  }

  // Placeholder brand colour until Hallow has a palette.
  public initializeMantineTheme(_ctx: ExtensionContext): MantineThemeOverride {
    return {
      colors: { hallow: hallowOrange },
      primaryColor: 'hallow',
    };
  }
}

export default new HallowExtension();
