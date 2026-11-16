import classNames from 'classnames';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import { useGlobalStore } from '@/stores/global.ts';

// Replaces the core footer: the panel's own name first, with credit to the project it is built on.
export default function Copyright({ className }: { className?: string }) {
  const appName = useGlobalStore((state) => state.settings.app.name);

  return (
    <div className={classNames('flex flex-col text-xs transition-all text-(--mantine-color-dimmed)', className)}>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.prependedComponents}
        name='global-copyright-prepended'
      />

      <span className='flex flex-row flex-wrap gap-x-1'>
        <span className='font-semibold'>{appName}</span>
        <span>&copy; {new Date().getFullYear()} Xena Studios · built on</span>
        <Anchor size='xs' href='https://calagopus.com' target='_blank'>
          Calagopus
        </Anchor>
      </span>

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.elements.copyright.appendedComponents}
        name='global-copyright-appended'
      />
    </div>
  );
}
