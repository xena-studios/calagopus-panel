import { Navigate, useLocation } from 'react-router';
import AdminHome from '@/pages/admin/home/AdminHome.tsx';

// Takes the place of the stock admin home route (`/admin/*`): `/admin` lands on the network
// Overview, and the stock home's tabs moved to System > Panel status, so their old addresses
// redirect there. Anything else under `/admin` falls through to the stock page as before.
export default function HallowAdminIndex() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '');

  if (path === '/admin') return <Navigate to='/admin/hallow/overview' replace />;
  if (path === '/admin/updates' || path === '/admin/health') {
    return <Navigate to={`/admin/panel${path.slice('/admin'.length)}`} replace />;
  }

  return <AdminHome />;
}
