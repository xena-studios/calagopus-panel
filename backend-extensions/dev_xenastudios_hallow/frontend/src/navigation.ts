import type { AdminRouteDefinition, AdminSidebarCategoryDefinition } from 'shared';
import type { RouteRegistry } from 'shared/src/registries/routes.ts';
import {
  faCrown,
  faGamepad,
  faGauge,
  faGavel,
  faGlobe,
  faHeartPulse,
  faLayerGroup,
  faShieldHalved,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { createElement } from 'react';
import { Navigate } from 'react-router';
import AnticheatPage from './pages/anticheat/AnticheatPage.tsx';
import FleetOverviewPage from './pages/fleet/FleetOverviewPage.tsx';
import FleetSettingsPage from './pages/fleet/FleetSettingsPage.tsx';
import HallowAdminIndex from './pages/home/HallowAdminIndex.tsx';
import PanelStatusPage from './pages/home/PanelStatusPage.tsx';
import NetworkSettingsPage from './pages/network-settings/NetworkSettingsPage.tsx';
import OverviewPage from './pages/overview/OverviewPage.tsx';
import PlayersPage from './pages/players/PlayersPage.tsx';
import PunishmentsPage from './pages/punishments/PunishmentsPage.tsx';
import RanksPage from './pages/ranks/RanksPage.tsx';

// The admin sidebar, network first. Calagopus is laid out for a hosting company; Hallow's admins
// run one Minecraft network, so the network comes first, then the machines it runs on, then staff
// and the panel itself. Hosting features Hallow rarely uses stay, collapsed, at the bottom.

const OVERVIEW = 'hallow-overview';
const FLEET = 'hallow-fleet';
const HOSTING = 'hallow-hosting';

const HALLOW_CATEGORIES: AdminSidebarCategoryDefinition[] = [
  { key: OVERVIEW, label: 'Overview' },
  { key: FLEET, label: 'Fleet' },
  { key: HOSTING, label: 'Hosting extras', collapsible: true, defaultCollapsed: true },
];

// Category order, top to bottom. Stock categories whose routes all moved end up empty and hidden;
// they stay in the list so another extension's routes in them still show.
const CATEGORY_ORDER = [OVERVIEW, FLEET, 'access', 'system', 'infrastructure', 'eggs', 'databases', 'storage', HOSTING];

const CATEGORY_LABELS: Record<string, string> = {
  access: 'Staff & Access',
  system: 'System',
};

// Where each stock route goes. Routes not listed keep their category.
const STOCK_CATEGORIES: Record<string, string> = {
  '/nodes/*': FLEET,
  '/servers/*': FLEET,
  '/locations/*': FLEET,
  '/nests/*': HOSTING,
  '/egg-library/*': HOSTING,
  '/egg-configurations/*': HOSTING,
  '/egg-repositories/*': HOSTING,
  '/database-hosts/*': HOSTING,
  '/database-agent-hosts/*': HOSTING,
  '/database-agent-templates/*': HOSTING,
  '/mounts/*': HOSTING,
  '/devices/*': HOSTING,
  '/backup-configurations/*': HOSTING,
  '/system-backup-policies/*': HOSTING,
};

// Order of routes within their categories. Unlisted routes go after these, in their own order.
const ROUTE_ORDER = [
  '/hallow/overview',
  '/hallow/players',
  '/hallow/punishments',
  '/hallow/ranks',
  '/hallow/anticheat',
  '/hallow/network-settings',
  '/hallow/fleet',
  '/nodes/*',
  '/servers/*',
  '/locations/*',
  '/hallow/fleet/settings',
  '/users/*',
  '/roles/*',
  '/oauth-providers/*',
  '/activity',
  '/settings/*',
  '/announcements/*',
  '/assets',
  '/extensions',
  '/panel/*',
];

const STOCK_HOME_PATH = '/*';

const NetworkRedirect = () => createElement(Navigate, { to: '/admin/hallow/overview', replace: true });

const hallowRoutes: AdminRouteDefinition[] = [
  {
    name: 'Overview',
    icon: faGauge,
    path: '/hallow/overview',
    element: OverviewPage,
    permission: 'hallow.network.read',
    category: OVERVIEW,
  },
  {
    name: 'Players',
    icon: faGamepad,
    path: '/hallow/players',
    element: PlayersPage,
    permission: 'hallow.players.read',
    category: OVERVIEW,
  },
  {
    name: 'Punishments',
    icon: faGavel,
    path: '/hallow/punishments',
    element: PunishmentsPage,
    permission: 'hallow.punishments.read',
    category: OVERVIEW,
  },
  {
    name: 'Ranks',
    icon: faCrown,
    path: '/hallow/ranks',
    element: RanksPage,
    permission: 'hallow.ranks.read',
    category: OVERVIEW,
  },
  {
    name: 'Anticheat',
    icon: faShieldHalved,
    path: '/hallow/anticheat',
    element: AnticheatPage,
    permission: 'hallow.anticheat.read',
    category: OVERVIEW,
  },
  {
    name: 'Network settings',
    icon: faGlobe,
    path: '/hallow/network-settings',
    element: NetworkSettingsPage,
    permission: ['extensions.read', 'hallow.network.read'],
    category: OVERVIEW,
  },
  {
    name: 'Fleet overview',
    icon: faLayerGroup,
    path: '/hallow/fleet',
    element: FleetOverviewPage,
    permission: ['nodes.*'],
    category: FLEET,
    exact: true,
  },
  {
    name: 'Fleet settings',
    icon: faSliders,
    path: '/hallow/fleet/settings',
    element: FleetSettingsPage,
    permission: 'hallow.fleet.read',
    category: FLEET,
  },
  {
    name: 'Panel status',
    icon: faHeartPulse,
    path: '/panel/*',
    element: PanelStatusPage,
    permission: null,
    category: 'system',
  },
  // The old placeholder Network page.
  { name: undefined, path: '/hallow/network', element: NetworkRedirect, permission: null },
];

function orderOf(list: string[], value: string): number {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

export function registerNavigation(routes: RouteRegistry) {
  for (const route of hallowRoutes) routes.addAdminRoute(route);

  for (const category of HALLOW_CATEGORIES) routes.addAdminSidebarCategory(category);

  // Runs on a fresh copy of the list each time the sidebar is built; replaces entries rather than
  // changing the shared stock objects.
  routes.addAdminSidebarCategoryInterceptor((categories) => {
    categories.forEach((category, index) => {
      const label = CATEGORY_LABELS[category.key];
      if (label) categories[index] = { ...category, label };
    });
    categories.sort((a, b) => orderOf(CATEGORY_ORDER, a.key) - orderOf(CATEGORY_ORDER, b.key));
  });

  routes.addAdminRouteInterceptor((list) => {
    list.forEach((route, index) => {
      if (route.path === STOCK_HOME_PATH) {
        // `/admin` lands on the Overview; the stock home lives on as System > Panel status.
        list[index] = { ...route, name: undefined, element: HallowAdminIndex };
        return;
      }
      const category = STOCK_CATEGORIES[route.path];
      if (category) list[index] = { ...route, category };
    });
    list.sort((a, b) => orderOf(ROUTE_ORDER, a.path) - orderOf(ROUTE_ORDER, b.path));
  });
}
