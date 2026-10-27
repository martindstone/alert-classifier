export type Region = 'us' | 'eu';
export type AlertStatus = 'triggered' | 'resolved';

/** Slimmed-down alert: only what's needed for display and grouping. */
export interface AlertRecord {
  id: string;
  status: string;
  severity: string;
  summary: string;
  createdAt: string;
  createdMs: number;
  htmlUrl: string;
  serviceId: string;
  serviceName: string;
  incidentId: string | null;
  incidentSummary: string | null;
  incidentUrl: string | null;
  /** Flattened, non-empty field values keyed by path, e.g. `details.host`. */
  fields: Record<string, string>;
}

export interface FetchRequest {
  nonce: number;
  source: 'api' | 'demo';
  region: Region;
  since: string;
  until: string;
  statuses: AlertStatus[];
}

export interface GroupingConfig {
  fields: string[];
  /** Minutes. 1440 is the "24 Hours (static)" window, measured from the incident's first alert;
   *  every other value slides from the incident's most recent alert. */
  windowMinutes: number;
}

export interface SimIncident {
  id: number;
  serviceId: string;
  serviceName: string;
  startMs: number;
  lastMs: number;
  alerts: AlertRecord[];
  keyValues: Record<string, Set<string>>;
}
