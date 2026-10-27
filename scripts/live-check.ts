// Sanity check against the real API: npx tsx --env-file=.env scripts/live-check.ts
import { fetchAlerts } from '../src/lib/pd';
import { computeFieldStats } from '../src/lib/fields';
import { simulateGrouping } from '../src/lib/grouping';

const until = new Date();
const since = new Date(until.getTime() - 30 * 24 * 3600_000);
const alerts = await fetchAlerts({
  token: process.env.PAGERDUTY_API_TOKEN!,
  region: 'us',
  since,
  until,
  statuses: ['triggered', 'resolved'],
});
console.log('alerts', alerts.length, 'real incidents', new Set(alerts.map((a) => a.incidentId)).size);
const stats = computeFieldStats(alerts);
console.table(stats.slice(0, 15).map((s) => ({ ...s, topValue: s.topValue.slice(0, 40) })));
for (const fields of [['summary'], ['component'], ['details.firing'], ['class', 'component']]) {
  const inc = simulateGrouping(alerts, { fields, windowMinutes: 1440 });
  console.log(fields.join('+'), '->', inc.length, 'incidents; sizes', inc.map((i) => i.alerts.length).sort((a, b) => b - a).slice(0, 8));
}
