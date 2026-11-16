import type { AdminRouteDefinition, AdminSidebarCategoryDefinition } from 'shared';
import { faChevronDown, faChevronRight, faReply } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Collapse, UnstyledButton } from '@mantine/core';
import { ReactNode, Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router';
import AppIcon from '@/elements/AppIcon.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Container from '@/elements/layout/Container.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Sidebar from '@/elements/navigation/Sidebar.tsx';
import QuickActionsTrigger from '@/elements/quickActions/QuickActionsTrigger.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { to } from '@/lib/routes.ts';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeStorage.ts';
import { checkPermissions, useAdminCan } from '@/plugins/usePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import adminRoutes, { adminSidebarCategoryOrder } from '@/routers/routes/adminRoutes.ts';
import { useAdminStore } from '@/stores/admin.tsx';

function AdminSidebarCategory({
  category,
  routes,
  children,
}: {
  category: AdminSidebarCategoryDefinition;
  routes: AdminRouteDefinition[];
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const storageKey = `admin_sidebar_collapsed:${category.key}`;
  const [collapsed, setCollapsed] = useState(() => {
    if (!category.collapsible) return false;
    const stored = safeLocalStorageGet(storageKey);
    return stored === null ? !!category.defaultCollapsed : stored === 'true';
  });

  if (!category.collapsible) {
    return (
      <>
        <Sidebar.Divider label={resolveString(category.label)} />
        {children}
      </>
    );
  }

  // A collapsed category still opens while one of its pages is showing.
  const containsActive = routes.some((route) => {
    const base = to(route.path, '/admin').replace(/\/\*$/, '');
    return pathname === base || pathname.startsWith(`${base}/`);
  });
  const open = !collapsed || containsActive;

  const toggle = () => {
    setCollapsed(open);
    safeLocalStorageSet(storageKey, open ? 'true' : 'false');
  };

  return (
    <>
      <UnstyledButton onClick={toggle} aria-expanded={open} className='w-full'>
        <Divider
          className='my-2'
          label={
            <span className='flex items-center gap-1.5'>
              {resolveString(category.label)}
              <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} size='xs' />
            </span>
          }
        />
      </UnstyledButton>
      <Collapse expanded={open}>
        <div className='flex flex-col'>{children}</div>
      </Collapse>
    </>
  );
}

export default function AdminRouter({ isNormal }: { isNormal: boolean }) {
  const { t } = useTranslations();
  const { user } = useAuth();
  const loadUpdateInformation = useAdminStore((state) => state.loadUpdateInformation);
  const canReadStats = useAdminCan('stats.read');

  useEffect(() => {
    if (!canReadStats) return;

    loadUpdateInformation();
  }, [canReadStats]);

  const allAdminRoutes = useMemo(() => {
    const routes = [...adminRoutes, ...window.extensionContext.extensionRegistry.routes.adminRoutes];

    for (const interceptor of window.extensionContext.extensionRegistry.routes.adminRouteInterceptors) {
      interceptor(routes);
    }

    return routes;
  }, []);

  const sidebarCategories = useMemo(() => {
    const registry = window.extensionContext.extensionRegistry.routes;
    const categories: AdminSidebarCategoryDefinition[] = [
      ...adminSidebarCategoryOrder,
      ...registry.adminSidebarCategories,
    ];

    for (const interceptor of registry.adminSidebarCategoryInterceptors) {
      interceptor(categories);
    }

    return categories;
  }, []);

  const sidebarGroups = useMemo(() => {
    const isVisible = (route: AdminRouteDefinition) => {
      if (!route.name || (route.filter && !route.filter())) return false;
      if (!route.permission) return true;
      if (user?.admin) return true;

      return checkPermissions(user?.role?.adminPermissions ?? [], route.permission).some(Boolean);
    };

    const visible = allAdminRoutes.filter(isVisible);
    const baseUncategorized = new Set(adminRoutes.filter((route) => !route.category).map((route) => route.path));
    const knownCategories = new Set(sidebarCategories.map((category) => category.key));

    const top = visible.filter((route) => !route.category && baseUncategorized.has(route.path));

    const categories = sidebarCategories
      .map((category) => ({
        category,
        routes: visible.filter((route) => route.category === category.key),
      }))
      .filter((group) => group.routes.length > 0);

    const other = visible.filter(
      (route) =>
        (!route.category && !baseUncategorized.has(route.path)) ||
        (!!route.category && !knownCategories.has(route.category)),
    );

    return { top, categories, other };
  }, [allAdminRoutes, sidebarCategories, user]);

  return (
    <div className='lg:flex h-full'>
      {isNormal && (
        <Sidebar
          header={
            <>
              <NavLink to='/' className='w-full'>
                <AppIcon />
              </NavLink>
              {!user?.suspended && (
                <>
                  <QuickActionsTrigger />
                  <div className='mt-2' />
                  <Sidebar.Link to='/' end icon={faReply} name={t('common.button.back', {})} />
                  <Sidebar.Divider />
                </>
              )}
            </>
          }
          footer={<Sidebar.Footer />}
        >
          {!user?.suspended && (
            <>
              {sidebarGroups.top.map((route) => (
                <Sidebar.Link
                  key={route.path}
                  to={to(route.path, '/admin')}
                  end={route.exact}
                  icon={route.icon}
                  name={resolveString(route.name)}
                  activeMatches={route.activeMatches}
                />
              ))}

              {sidebarGroups.categories.map((group) => (
                <AdminSidebarCategory key={group.category.key} category={group.category} routes={group.routes}>
                  {group.routes.map((route) => (
                    <Sidebar.Link
                      key={route.path}
                      to={to(route.path, '/admin')}
                      end={route.exact}
                      icon={route.icon}
                      name={resolveString(route.name)}
                      activeMatches={route.activeMatches}
                    />
                  ))}
                </AdminSidebarCategory>
              ))}

              {sidebarGroups.other.length > 0 && (
                <>
                  <Sidebar.Divider />
                  {sidebarGroups.other.map((route) => (
                    <Sidebar.Link
                      key={route.path}
                      to={to(route.path, '/admin')}
                      end={route.exact}
                      icon={route.icon}
                      name={resolveString(route.name)}
                      activeMatches={route.activeMatches}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </Sidebar>
      )}

      <div
        id='admin-root'
        className={isNormal ? 'max-w-[100vw] min-w-0 flex-1 lg:ml-0' : 'flex-1 lg:ml-0 overflow-auto h-full'}
      >
        <Container isNormal={isNormal}>
          {user?.suspended ? (
            <ScreenBlock
              title={t('elements.screenBlock.suspended.title', {})}
              content={t('elements.screenBlock.suspended.content', {})}
            />
          ) : (
            <>
              <ExtensionSlot
                components={window.extensionContext.extensionRegistry.pages.admin.prependedComponents}
                name='admin-prepended-component'
              />

              <Suspense fallback={<Spinner.Centered />}>
                <Routes>
                  {allAdminRoutes
                    .filter((route) => !route.filter || route.filter())
                    .map(({ path, element: Element, permission }) => (
                      <Route
                        key={path}
                        element={<AdminPermissionGuard permission={permission ?? []} matchAny={!!permission} />}
                      >
                        <Route path={path} element={<Element />} />
                      </Route>
                    ))}
                  <Route
                    path='*'
                    element={
                      <AdminContentContainer title={t('elements.screenBlock.notFound.title', {})} hideTitleComponent>
                        <ScreenBlock
                          title={t('elements.screenBlock.notFound.title', {})}
                          content={t('elements.screenBlock.notFound.content', {})}
                        />
                      </AdminContentContainer>
                    }
                  />
                </Routes>
              </Suspense>

              <ExtensionSlot
                components={window.extensionContext.extensionRegistry.pages.admin.appendedComponents}
                name='admin-appended-component'
              />
            </>
          )}
        </Container>
      </div>
    </div>
  );
}
