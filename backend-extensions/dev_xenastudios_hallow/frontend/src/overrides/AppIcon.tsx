import { useComputedColorScheme } from '@mantine/core';
import classNames from 'classnames';
import { makeComponentHookable } from 'shared';
import { useGlobalStore } from '@/stores/global.ts';

// Replaces the core AppIcon (sidebar and setup headers): the logo, the configured name and
// what the panel is for. A configured banner still wins, as in the core.
function AppIcon({ className }: { className?: string }) {
  const settings = useGlobalStore((state) => state.settings);
  const isLight = useComputedColorScheme('dark') === 'light';

  if (settings.app.banner) {
    return (
      <div className={classNames('w-full mt-1 select-none', className)}>
        <img
          src={isLight ? (settings.app.bannerLight ?? settings.app.banner) : settings.app.banner}
          className='w-full h-auto'
          alt={`${settings.app.name} banner`}
        />
      </div>
    );
  }

  return (
    <div className={classNames('hallow-brand', className)}>
      <img
        src={isLight ? (settings.app.iconLight ?? settings.app.icon) : settings.app.icon}
        className='hallow-brand-mark'
        alt=''
      />
      <div className='hallow-brand-text'>
        <span className='hallow-brand-name'>{settings.app.name}</span>
        <span className='hallow-brand-tagline'>Network control</span>
      </div>
    </div>
  );
}

export default makeComponentHookable(AppIcon);
