import { faArrowDown, faArrowUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Input, Table, TagsInput, Text } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import type { FleetProvider, FleetSettings } from '../../lib/fleet.ts';

interface Props {
  form: UseFormReturnType<FleetSettings>;
  disabled?: boolean;
}

const newProvider = (): FleetProvider => ({ name: '', enabled: false, regions: [], machine_types: [] });

export default function ProvidersTable({ form, disabled }: Props) {
  const providers = form.values.providers;
  const listError = form.errors.providers;

  return (
    <>
      <Text size='sm' c='dimmed' mb='sm'>
        Providers the fleet manager may buy from, in order of preference. Leave regions or machine types empty to
        allow any.
      </Text>
      {listError && <Input.Error mb='sm'>{listError}</Input.Error>}

      <Table.ScrollContainer minWidth={760}>
        <Table verticalSpacing='sm' withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={80}>Enabled</Table.Th>
              <Table.Th w={200}>Name</Table.Th>
              <Table.Th>Regions</Table.Th>
              <Table.Th>Machine types</Table.Th>
              <Table.Th w={110} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {providers.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size='sm' c='dimmed' ta='center' py='md'>
                    No providers. The fleet manager can't buy any machines.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
            {providers.map((provider, index) => (
              <Table.Tr key={form.key(`providers.${index}`)}>
                <Table.Td>
                  <Switch
                    aria-label={`Enable ${provider.name || 'provider'}`}
                    disabled={disabled}
                    {...form.getInputProps(`providers.${index}.enabled`, { type: 'checkbox' })}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    placeholder='hetzner-cloud'
                    aria-label='Provider name'
                    disabled={disabled}
                    {...form.getInputProps(`providers.${index}.name`)}
                  />
                </Table.Td>
                <Table.Td>
                  <TagsInput
                    placeholder={provider.regions.length ? 'Add region' : 'Any region'}
                    aria-label='Regions'
                    splitChars={[',', ' ']}
                    clearable
                    disabled={disabled}
                    {...form.getInputProps(`providers.${index}.regions`)}
                  />
                </Table.Td>
                <Table.Td>
                  <TagsInput
                    placeholder={provider.machine_types.length ? 'Add machine type' : 'Any machine type'}
                    aria-label='Machine types'
                    splitChars={[',', ' ']}
                    clearable
                    disabled={disabled}
                    {...form.getInputProps(`providers.${index}.machine_types`)}
                  />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap='nowrap' justify='flex-end'>
                    <Tooltip label='Move up'>
                      <ActionIcon
                        variant='subtle'
                        color='gray'
                        disabled={disabled || index === 0}
                        onClick={() => form.reorderListItem('providers', { from: index, to: index - 1 })}
                      >
                        <FontAwesomeIcon icon={faArrowUp} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label='Move down'>
                      <ActionIcon
                        variant='subtle'
                        color='gray'
                        disabled={disabled || index === providers.length - 1}
                        onClick={() => form.reorderListItem('providers', { from: index, to: index + 1 })}
                      >
                        <FontAwesomeIcon icon={faArrowDown} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label='Remove'>
                      <ActionIcon
                        variant='subtle'
                        color='red'
                        disabled={disabled}
                        onClick={() => form.removeListItem('providers', index)}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Button
        mt='sm'
        variant='default'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
        disabled={disabled}
        onClick={() => form.insertListItem('providers', newProvider())}
      >
        Add provider
      </Button>
    </>
  );
}
