import { useMemo, useRef, useState } from 'react';
import { Alert, Container, MultiSelect, Paper, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle } from '@tabler/icons-react';
import { ConnectionPanel, toLocalInput, type ConnectionState } from './components/ConnectionPanel';
import { FieldPicker } from './components/FieldPicker';
import { Results } from './components/Results';
import { generateDemoAlerts } from './lib/demo';
import { computeFieldStats } from './lib/fields';
import { simulateGrouping } from './lib/grouping';
import { fetchAlerts } from './lib/pd';
import type { FetchRequest } from './lib/types';

const initialConnection = (): ConnectionState => {
  const now = new Date();
  return {
    token: '',
    region: 'us',
    since: toLocalInput(new Date(now.getTime() - 7 * 24 * 3600_000)),
    until: toLocalInput(now),
    statuses: ['triggered', 'resolved'],
  };
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="lg" radius="md">
      <Title order={3} mb="md">
        {n}. {title}
      </Title>
      {children}
    </Paper>
  );
}

export default function App() {
  const [conn, setConn] = useState(initialConnection);
  const [request, setRequest] = useState<FetchRequest | null>(null);
  const [progress, setProgress] = useState(0);
  const [minCount, setMinCount] = useState(5);
  const [selected, setSelected] = useState<string[]>([]);
  /** Service ids to keep; empty means all services. */
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const tokenRef = useRef(conn.token);
  tokenRef.current = conn.token;

  const query = useQuery({
    queryKey: ['alerts', request],
    enabled: request !== null,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const r = request!;
      setProgress(0);
      const since = new Date(r.since);
      const until = new Date(r.until);
      if (r.source === 'demo') return generateDemoAlerts(since, until);
      return fetchAlerts({
        token: tokenRef.current.trim(),
        region: r.region,
        since,
        until,
        statuses: r.statuses,
        signal,
        onProgress: setProgress,
      });
    },
  });

  const start = (source: FetchRequest['source']) => {
    setSelected([]);
    setServiceFilter([]);
    setRequest({
      nonce: Date.now(),
      source,
      region: conn.region,
      since: conn.since,
      until: conn.until,
      statuses: conn.statuses,
    });
  };

  const allAlerts = query.data;
  const serviceOptions = useMemo(() => {
    const counts = new Map<string, { name: string; n: number }>();
    for (const a of allAlerts ?? []) {
      const c = counts.get(a.serviceId) ?? { name: a.serviceName, n: 0 };
      c.n++;
      counts.set(a.serviceId, c);
    }
    return [...counts]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([value, c]) => ({ value, label: `${c.name} (${c.n})` }));
  }, [allAlerts]);
  const alerts = useMemo(
    () => (serviceFilter.length ? allAlerts?.filter((a) => serviceFilter.includes(a.serviceId)) : allAlerts),
    [allAlerts, serviceFilter],
  );
  const stats = useMemo(() => (alerts ? computeFieldStats(alerts) : []), [alerts]);
  // A field may stop qualifying when the threshold rises; ignore such stale selections.
  const fields = useMemo(() => {
    const ok = new Set(stats.filter((s) => s.present > minCount).map((s) => s.path));
    return selected.filter((f) => ok.has(f));
  }, [stats, minCount, selected]);
  const incidents = useMemo(
    () => (alerts ? simulateGrouping(alerts, { windowMinutes, fields }) : []),
    [alerts, windowMinutes, fields],
  );

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Content-based alert grouping explorer</Title>
          <Text c="dimmed">
            Download PagerDuty alerts, find fields they share, and preview how many incidents you’d get if
            content-based grouping were enabled on the fields you pick.
          </Text>
        </div>

        <Section n={1} title="Download alerts">
          <ConnectionPanel
            value={conn}
            onChange={setConn}
            onFetch={() => start('api')}
            onDemo={() => start('demo')}
            loading={query.isFetching}
            progress={progress}
          />
          {query.isError && (
            <Alert mt="md" color="red" icon={<IconAlertCircle />} title="Couldn’t download alerts">
              {(query.error as Error).message}
            </Alert>
          )}
          {allAlerts && !query.isFetching && (
            <Text mt="md" size="sm" c="dimmed">
              Loaded {allAlerts.length} alerts{request?.source === 'demo' ? ' (demo data)' : ''}.
            </Text>
          )}
        </Section>

        {alerts && alerts.length === 0 && (
          <Alert color="yellow" title="No alerts in that period">
            Try a wider time range, include both statuses, or change the service filter.
          </Alert>
        )}

        {alerts && alerts.length > 0 && (
          <>
            <Section n={2} title="Choose services and fields to group on">
              <MultiSelect
                mb="md"
                label="Services"
                description="Limit field analysis and grouping to these services (filtered here, after download)"
                placeholder={serviceFilter.length ? undefined : `All services (${serviceOptions.length})`}
                data={serviceOptions}
                value={serviceFilter}
                onChange={setServiceFilter}
                searchable
                clearable
              />
              <FieldPicker
                stats={stats}
                total={alerts.length}
                minCount={minCount}
                onMinCountChange={setMinCount}
                selected={fields}
                onSelectedChange={setSelected}
              />
            </Section>

            <Section n={3} title="Resulting incidents">
              <Results
                alerts={alerts}
                incidents={incidents}
                config={{ windowMinutes, fields }}
                onConfigChange={(c) => setWindowMinutes(c.windowMinutes)}
              />
            </Section>
          </>
        )}
      </Stack>
    </Container>
  );
}
