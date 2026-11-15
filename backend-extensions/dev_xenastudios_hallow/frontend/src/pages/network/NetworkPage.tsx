import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';

// Placeholder for the Network page (#24). It will list proxies, servers and
// the player count from the control plane: GET /v1/proxies, GET /v1/servers
// and GET /v1/presence/count (crates/proto/src/routes.rs in the Hallow repo),
// fetched through a backend route under /api/admin/hallow so the control
// plane stays off the public internet.
export default function NetworkPage() {
  return (
    <AdminContentContainer title='Network' subtitle='Proxies, servers and players across the Hallow network.'>
      <Alert icon={<FontAwesomeIcon icon={faNetworkWired} />} title='Coming soon'>
        The live network view arrives with the control plane integration.
      </Alert>
    </AdminContentContainer>
  );
}
