import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { FieldStat } from '../lib/fields';

interface Props {
  stats: FieldStat[];
  total: number;
  minCount: number;
  onMinCountChange: (n: number) => void;
  selected: string[];
  onSelectedChange: (fields: string[]) => void;
}

const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n) + '…' : s);

export function FieldPicker({ stats, total, minCount, onMinCountChange, selected, onSelectedChange }: Props) {
  const [query, setQuery] = useState('');
  const eligible = useMemo(() => stats.filter((s) => s.present > minCount), [stats, minCount]);
  const rows = useMemo(
    () => eligible.filter((s) => s.path.toLowerCase().includes(query.toLowerCase())),
    [eligible, query],
  );
  const sel = new Set(selected);
  const toggle = (path: string) =>
    onSelectedChange(sel.has(path) ? selected.filter((p) => p !== path) : [...selected, path]);

  return (
    <Stack gap="sm">
      <Group align="flex-end">
        <NumberInput
          label="Show fields present in more than … alerts"
          value={minCount}
          min={0}
          max={total}
          allowNegative={false}
          allowDecimal={false}
          onChange={(v) => onMinCountChange(typeof v === 'number' ? v : 0)}
          w={300}
        />
        <TextInput
          label="Filter"
          placeholder="field name"
          leftSection={<IconSearch size={14} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Button variant="subtle" disabled={!selected.length} onClick={() => onSelectedChange([])}>
          Clear selection
        </Button>
        <Text size="sm" c="dimmed" pb={8}>
          {eligible.length} of {stats.length} fields qualify · {selected.length} selected
        </Text>
      </Group>

      <ScrollArea.Autosize mah={380} type="auto">
        <Table stickyHeader highlightOnHover verticalSpacing={4}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>Field</Table.Th>
              <Table.Th ta="right">Present in</Table.Th>
              <Table.Th ta="right">Distinct values</Table.Th>
              <Table.Th>Most common value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => (
              <Table.Tr key={s.path} onClick={() => toggle(s.path)} style={{ cursor: 'pointer' }}>
                <Table.Td>
                  <Checkbox
                    checked={sel.has(s.path)}
                    onChange={() => toggle(s.path)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={s.path}
                  />
                </Table.Td>
                <Table.Td ff="monospace" fz="sm">
                  {s.path}
                </Table.Td>
                <Table.Td ta="right">
                  {s.present}{' '}
                  <Text span size="xs" c="dimmed">
                    ({Math.round((s.present / total) * 100)}%)
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Badge variant="light" color={s.distinct === s.present ? 'gray' : 'blue'}>
                    {s.distinct}
                  </Badge>
                </Table.Td>
                <Table.Td fz="sm">
                  <Tooltip label={s.topValue} multiline maw={500} disabled={s.topValue.length <= 60}>
                    <span>
                      {truncate(s.topValue.replace(/\s+/g, ' '))}{' '}
                      <Text span size="xs" c="dimmed">
                        ×{s.topCount}
                      </Text>
                    </span>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!rows.length && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    No fields match.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
    </Stack>
  );
}
