import { faCogs, faGraduationCap, faPlug, faRocket, faUsers } from '@fortawesome/free-solid-svg-icons';
import OobeConfiguration from '@/pages/oobe/OobeConfiguration.tsx';
import OobeLogin from '@/pages/oobe/OobeLogin.tsx';
import OobeRegister from '@/pages/oobe/OobeRegister.tsx';
import type { OobeStep } from '@/routers/oobeSteps.ts';
import OobeControlPlane from './OobeControlPlane.tsx';
import OobeFinished from './OobeFinished.tsx';
import OobeWelcome from './OobeWelcome.tsx';

// Hallow's setup wizard, replacing the core's step list: account, application settings, the
// control plane connection, done. Hosting steps (egg repositories, location, node, first server)
// are left out; nodes are added from Fleet when the network needs them.
//
// Step keys come from the core's fixed list (the backend stores them), so the control plane step
// reuses `repositories`, the step that followed `configuration` in the core wizard.
export const steps: OobeStep[] = [
  {
    path: '',
    stepKey: 'register',
    label: 'Welcome',
    description: 'Welcome to Hallow',
    icon: faRocket,
    component: OobeWelcome,
    preAuth: true,
  },
  {
    path: '/register',
    stepKey: null,
    label: 'Account',
    description: 'Your administrator account',
    icon: faUsers,
    component: OobeRegister,
    preAuth: true,
  },
  {
    path: '/login',
    stepKey: null,
    label: null,
    icon: null,
    component: OobeLogin,
    preAuth: true,
  },
  {
    path: '/configuration',
    stepKey: 'configuration',
    label: 'Panel',
    description: 'Name, address and sign-up',
    icon: faCogs,
    component: OobeConfiguration,
  },
  {
    path: '/control-plane',
    stepKey: 'repositories',
    label: 'Control plane',
    description: 'Connect to the network',
    icon: faPlug,
    component: OobeControlPlane,
  },
  {
    path: '/finish',
    stepKey: 'finished',
    label: 'Finish',
    description: 'Ready to run the network',
    icon: faGraduationCap,
    component: OobeFinished,
  },
];
