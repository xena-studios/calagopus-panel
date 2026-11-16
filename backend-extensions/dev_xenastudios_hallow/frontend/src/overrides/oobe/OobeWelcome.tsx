import { faCheckCircle, faRocket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from '@/elements/buttons/Button.tsx';
import ThemeIcon from '@/elements/data-display/ThemeIcon.tsx';
import List from '@/elements/layout/List.tsx';
import Text from '@/elements/typography/Text.tsx';
import type { OobeComponentProps } from '@/routers/OobeRouter.tsx';

export default function OobeWelcome({ onNext }: OobeComponentProps) {
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Text size='md' fw={500}>
          Three short steps and the panel is running your network:
        </Text>

        <List
          spacing='sm'
          size='sm'
          center
          icon={
            <ThemeIcon color='hallow' size={20} radius='xl'>
              <FontAwesomeIcon icon={faCheckCircle} size='xs' />
            </ThemeIcon>
          }
        >
          <List.Item>Create your administrator account</List.Item>
          <List.Item>Name the panel and set its address</List.Item>
          <List.Item>Connect the Hallow control plane, so the panel sees players, proxies and servers</List.Item>
        </List>
        <Text size='sm' c='dimmed'>
          Machines (nodes) are added later from Fleet, when the network needs them.
        </Text>
      </div>

      <Button
        className='md:max-w-fit md:ml-auto'
        leftSection={<FontAwesomeIcon icon={faRocket} />}
        onClick={() => onNext()}
      >
        Get started
      </Button>
    </div>
  );
}
