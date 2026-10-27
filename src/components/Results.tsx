import { useMemo, useState } from 'react';
import {
  Accordion,
  Anchor,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import type { AlertRecord, GroupingConfig, SimIncident } from '../lib/types';

interface Props {
  alerts: AlertRecord[];
  incidents: SimIncident[];
  config: GroupingConfig;
  onConfigChange: (c: GroupingConfig) => void;
}

const PAGE = 100;
const WINDOWS = [
  { value: '5', label: '5 minutes (recommended)' },
  ...[10, 15, 20, 30, 40, 50, 60].map((m) => ({ value: String(m), label: `${m} minutes` })),
  { value: '1440', label: '24 Hours (static)' },
];
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);
const fmt = (ms: number) => new Date(ms).toLocaleString();

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fz={28} fw={700} lh={1.2}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

export function Results({ alerts, incidents, config, onConfigChange }: Props) {
  const [showSingles, setShowSingles] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const actual = useMemo(() => new Set(alerts.map((a) => a.incidentId ?? `none:${a.id}`)).size, [alerts]);
  const multi = incidents.filter((i) => i.alerts.length > 1);
  const singles = incidents.length - multi.length;
  const reduction = alerts.length ? Math.round((1 - incidents.length / alerts.length) * 100) : 0;
  const visible = useMemo(
    () => (showSingles ? incidents : multi).slice().sort((a, b) => b.alerts.length - a.alerts.length || a.startMs - b.startMs),
    [incidents, multi, showSingles],
  );

  return (
    <Stack gap="md">
      <Select
        label="Time window"
        description="Alerts group only within this window of the incident"
        data={WINDOWS}
        value={String(config.windowMinutes)}
        onChange={(v) => v && onConfigChange({ ...config, windowMinutes: Number(v) })}
        allowDeselect={false}
        w={320}
      />

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <Stat label="Alerts" value={alerts.length} />
        <Stat label="Incidents today" value={actual} hint="distinct incidents these alerts belong to now" />
        <Stat label="Incidents with grouping" value={incidents.length} hint={`${multi.length} multi-alert · ${singles} single-alert`} />
        <Stat label="Reduction" value={`${reduction}%`} hint="vs. one incident per alert" />
      </SimpleGrid>

      <Group justify="space-between">
        <Text fw={600}>
          {showSingles ? `All ${incidents.length} incidents` : `${multi.length} multi-alert incidents`}
        </Text>
        <Switch
          checked={showSingles}
          onChange={(e) => setShowSingles(e.currentTarget.checked)}
          label="Include single-alert incidents"
        />
      </Group>

      {!config.fields.length && (
        <Text c="dimmed">Select at least one field above to see how alerts would group.</Text>
      )}

      <Accordion variant="separated" chevronPosition="left">
        {visible.slice(0, limit).map((inc) => (
          <Accordion.Item key={inc.id} value={String(inc.id)}>
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" pr="sm">
                <Stack gap={2} miw={0}>
                  <Group gap="xs">
                    <Badge color={inc.alerts.length > 1 ? 'blue' : 'gray'}>
                      {inc.alerts.length} alert{inc.alerts.length === 1 ? '' : 's'}
                    </Badge>
                    <Text size="sm" fw={600}>
                      {inc.serviceName}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" truncate>
                    {Object.entries(inc.keyValues)
                      .map(([f, vs]) => {
                        const arr = [...vs];
                        return `${f}=${truncate(arr.slice(0, 2).join(' | '), 60)}${arr.length > 2 ? ` (+${arr.length - 2})` : ''}`;
                      })
                      .join('  ·  ') || 'no grouping key (missing field)'}
                  </Text>
                </Stack>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {fmt(inc.startMs)}
                </Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Table fz="sm" verticalSpacing={4}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Alert</Table.Th>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Incident today</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {inc.alerts.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt(a.createdMs)}</Table.Td>
                      <Table.Td>
                        <Anchor href={a.htmlUrl} target="_blank" rel="noreferrer" size="sm">
                          {truncate(a.summary || a.id, 100)}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>{a.severity}</Table.Td>
                      <Table.Td>{a.status}</Table.Td>
                      <Table.Td>
                        {a.incidentUrl ? (
                          <Anchor href={a.incidentUrl} target="_blank" rel="noreferrer" size="sm">
                            {a.incidentSummary?.match(/^\[#\d+\]/)?.[0] ?? a.incidentId}
                          </Anchor>
                        ) : (
                          '—'
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      {visible.length > limit && (
        <Button variant="default" onClick={() => setLimit(limit + PAGE)}>
          Show {Math.min(PAGE, visible.length - limit)} more ({visible.length - limit} remaining)
        </Button>
      )}
    </Stack>
  );
}
