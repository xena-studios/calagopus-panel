import { faCog, faHeartPulse, faRefresh } from '@fortawesome/free-solid-svg-icons';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import AdminOverviewHealth from '@/pages/admin/home/health/AdminOverviewHealth.tsx';
import AdminOverview from '@/pages/admin/home/overview/AdminOverview.tsx';
import AdminOverviewUpdates from '@/pages/admin/home/updates/AdminOverviewUpdates.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

// The stock admin home (panel statistics, updates and health) under System, since `/admin` now
// lands on the network Overview. Same tabs and extension registries as the stock page.
export default function PanelStatusPage() {
  const { t } = useTranslations();

  return (
    <AdminContentContainer
      title='Panel status'
      subtitle='The panel itself: statistics, updates and health.'
      registry={window.extensionContext.extensionRegistry.pages.admin.home.container}
    >
      <SubNavigation
        baseUrl='/admin/panel'
        registry={window.extensionContext.extensionRegistry.pages.admin.home.subNavigation}
        registryProps={{}}
        items={[
          {
            name: t('pages.admin.home.tabs.overview.title', {}),
            icon: faCog,
            path: `/`,
            element: <AdminOverview />,
          },
          {
            name: t('pages.admin.home.tabs.updates.title', {}),
            icon: faRefresh,
            path: `/updates`,
            element: <AdminOverviewUpdates />,
            permission: 'stats.read',
          },
          {
            name: t('pages.admin.home.tabs.health.title', {}),
            icon: faHeartPulse,
            path: `/health`,
            element: <AdminOverviewHealth />,
            permission: 'stats.read',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
