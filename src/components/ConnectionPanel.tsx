import { Button, Chip, Group, PasswordInput, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { IconDownload, IconFlask } from '@tabler/icons-react';
import type { AlertStatus, Region } from '../lib/types';

export interface ConnectionState {
  token: string;
  region: Region;
  since: string;
  until: string;
  statuses: AlertStatus[];
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Format for <input type="datetime-local">, in local time. */
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const PRESETS: { label: string; hours: number }[] = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
  { label: '90d', hours: 24 * 90 },
];

interface Props {
  value: ConnectionState;
  onChange: (v: ConnectionState) => void;
  onFetch: () => void;
  onDemo: () => void;
  loading: boolean;
  progress: number;
}

export function ConnectionPanel({ value, onChange, onFetch, onDemo, loading, progress }: Props) {
  const set = (patch: Partial<ConnectionState>) => onChange({ ...value, ...patch });
  const preset = (hours: number) => {
    const now = new Date();
    set({ since: toLocalInput(new Date(now.getTime() - hours * 3600_000)), until: toLocalInput(now) });
  };
  const invalid = !value.since || !value.until || new Date(value.since) >= new Date(value.until) || !value.statuses.length;

  return (
    <Stack gap="md">
      <Group align="flex-end" grow>
        <PasswordInput
          label="PagerDuty REST API token"
          description="Kept in memory only; sent straight to the PagerDuty API from your browser."
          placeholder="u+xxxxxxxxxxxxxxxxxxxx"
          value={value.token}
          onChange={(e) => set({ token: e.currentTarget.value })}
          autoComplete="off"
          style={{ flex: 3 }}
        />
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500} mb={4}>
            Region
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { label: 'US', value: 'us' },
              { label: 'EU', value: 'eu' },
            ]}
            value={value.region}
            onChange={(r) => set({ region: r as Region })}
          />
        </div>
      </Group>

      <Group align="flex-end" gap="md">
        <TextInput
          type="datetime-local"
          label="Since"
          value={value.since}
          onChange={(e) => set({ since: e.currentTarget.value })}
        />
        <TextInput
          type="datetime-local"
          label="Until"
          value={value.until}
          onChange={(e) => set({ until: e.currentTarget.value })}
        />
        <Button.Group>
          {PRESETS.map((p) => (
            <Button key={p.label} variant="default" onClick={() => preset(p.hours)}>
              {p.label}
            </Button>
          ))}
        </Button.Group>
        <div>
          <Text size="sm" fw={500} mb={4}>
            Statuses
          </Text>
          <Chip.Group
            multiple
            value={value.statuses}
            onChange={(s) => set({ statuses: s as AlertStatus[] })}
          >
            <Group gap="xs">
              <Chip value="triggered">triggered</Chip>
              <Chip value="resolved">resolved</Chip>
            </Group>
          </Chip.Group>
        </div>
      </Group>

      <Group>
        <Button
          leftSection={<IconDownload size={16} />}
          onClick={onFetch}
          loading={loading}
          disabled={!value.token.trim() || invalid}
        >
          {loading ? `Downloading… ${progress} alerts` : 'Download alerts'}
        </Button>
        <Button variant="subtle" leftSection={<IconFlask size={16} />} onClick={onDemo} disabled={loading || invalid}>
          Use demo data
        </Button>
      </Group>
    </Stack>
  );
}
