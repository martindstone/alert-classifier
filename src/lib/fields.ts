import type { AlertRecord } from './types';

export interface FieldStat {
  path: string;
  present: number;
  distinct: number;
  topValue: string;
  topCount: number;
}

export function computeFieldStats(alerts: AlertRecord[]): FieldStat[] {
  const perField = new Map<string, Map<string, number>>();
  for (const a of alerts) {
    for (const [path, value] of Object.entries(a.fields)) {
      let values = perField.get(path);
      if (!values) perField.set(path, (values = new Map()));
      values.set(value, (values.get(value) ?? 0) + 1);
    }
  }
  const stats: FieldStat[] = [];
  for (const [path, values] of perField) {
    let present = 0;
    let topValue = '';
    let topCount = 0;
    for (const [v, n] of values) {
      present += n;
      if (n > topCount) {
        topCount = n;
        topValue = v;
      }
    }
    stats.push({ path, present, distinct: values.size, topValue, topCount });
  }
  return stats.sort((a, b) => b.present - a.present || a.path.localeCompare(b.path));
}
