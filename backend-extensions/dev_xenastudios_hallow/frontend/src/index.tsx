import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import type { MantineThemeOverride } from '@mantine/core';
import { Extension, ExtensionContext } from 'shared';
import NetworkPage from './pages/network/NetworkPage.tsx';
import { hallowOrange } from './theme.ts';

class HallowExtension extends Extension {
  public cardConfigurationPage: React.FC | null = null;
  public cardComponent: React.FC | null = null;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.enterRoutes((routes) =>
      routes.addAdminRoute({
        name: 'Network',
        icon: faNetworkWired,
        path: '/hallow/network',
        element: NetworkPage,
        // The admin router already requires an admin. Hallow permissions
        // (`hallow.network.*`) come with the staff roles in #25.
        permission: null,
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
