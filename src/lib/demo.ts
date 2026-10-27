import { toRecord } from './pd';
import type { AlertRecord } from './types';

/** Deterministic synthetic alerts so the UI can be explored without a PagerDuty token. */
export function generateDemoAlerts(since: Date, until: Date): AlertRecord[] {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

  const services = [
    { id: 'PSVC001', name: 'Web Frontend (demo)', component: 'frontend', alerts: ['error-log-rate', 'latency-p99', 'http-5xx'] },
    { id: 'PSVC002', name: 'Payments API (demo)', component: 'payments', alerts: ['queue-depth', 'db-connections', 'http-5xx'] },
    { id: 'PSVC003', name: 'Data Pipeline (demo)', component: 'pipeline', alerts: ['job-failed', 'lag-seconds'] },
  ];
  const hosts = ['web-1', 'web-2', 'web-3', 'api-1', 'api-2', 'etl-1'];
  const regions = ['us-east-1', 'us-west-2', 'eu-west-1'];

  const span = until.getTime() - since.getTime();
  const out: AlertRecord[] = [];
  const bursts = 40;
  for (let b = 0; b < bursts; b++) {
    const svc = pick(services);
    const alertname = pick(svc.alerts);
    const region = pick(regions);
    const t0 = since.getTime() + rnd() * span;
    const n = 1 + Math.floor(rnd() ** 2 * 14);
    for (let i = 0; i < n; i++) {
      const host = pick(hosts);
      const created = new Date(t0 + rnd() * 20 * 60_000).toISOString();
      const id = `DEMO${String(out.length).padStart(5, '0')}`;
      const details: Record<string, unknown> = {
        alertname,
        host,
        region,
        value: String(Math.round(rnd() * 100)),
      };
      if (rnd() > 0.3) details.runbook = `https://runbooks.example.com/${alertname}`;
      out.push(
        toRecord({
          id,
          status: rnd() > 0.2 ? 'resolved' : 'triggered',
          summary: `[FIRING] ${alertname} on ${host}`,
          severity: pick(['critical', 'warning', 'warning']),
          created_at: created,
          html_url: '#',
          service: { id: svc.id, summary: svc.name },
          incident: { id: `DEMOINC${b}`, summary: `[#${b}] ${alertname}`, html_url: '#' },
          body: {
            cef_details: {
              description: `[FIRING] ${alertname} on ${host}`,
              source_origin: 'demo-monitor',
              source_component: svc.component,
              service_group: 'demo',
              event_class: `${svc.component}-alert`,
              severity: 'warning',
              dedup_key: id,
              details,
            },
          },
        }),
      );
    }
  }
  return out;
}
