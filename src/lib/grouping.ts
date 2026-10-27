import type { AlertRecord, GroupingConfig, SimIncident } from './types';

const SEP = '\u0000';
export const STATIC_WINDOW_MINUTES = 1440;

/**
 * Replays alerts in creation order through content-based alert grouping on the chosen fields.
 * Grouping is per service. An alert joins the open incident whose selected field values all
 * match exactly; alerts missing any selected field are never grouped. The 24-hour window is
 * static (from the incident's first alert), shorter windows slide from its latest alert.
 */
export function simulateGrouping(alerts: AlertRecord[], cfg: GroupingConfig): SimIncident[] {
  const windowMs = cfg.windowMinutes * 60_000;
  const isStatic = cfg.windowMinutes === STATIC_WINDOW_MINUTES;
  const sorted = [...alerts].sort((a, b) => a.createdMs - b.createdMs || a.id.localeCompare(b.id));
  const indexByService = new Map<string, Map<string, SimIncident>>();
  const incidents: SimIncident[] = [];

  for (const alert of sorted) {
    let index = indexByService.get(alert.serviceId);
    if (!index) indexByService.set(alert.serviceId, (index = new Map()));

    const values = cfg.fields.map((f) => alert.fields[f]);
    const key = cfg.fields.length && values.every((v) => v !== undefined) ? values.join(SEP) : null;

    let target = key === null ? undefined : index.get(key);
    if (target && alert.createdMs - (isStatic ? target.startMs : target.lastMs) > windowMs) target = undefined;

    if (!target) {
      target = {
        id: incidents.length + 1,
        serviceId: alert.serviceId,
        serviceName: alert.serviceName,
        startMs: alert.createdMs,
        lastMs: alert.createdMs,
        alerts: [],
        keyValues: {},
      };
      incidents.push(target);
      if (key !== null) {
        index.set(key, target);
        cfg.fields.forEach((f, i) => (target!.keyValues[f] = new Set([values[i]])));
      }
    }
    target.alerts.push(alert);
    target.lastMs = alert.createdMs;
  }
  return incidents;
}
