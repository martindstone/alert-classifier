import type { AlertRecord, AlertStatus, Region } from './types';

const BASE: Record<Region, string> = {
  us: 'https://api.pagerduty.com',
  eu: 'https://api.eu.pagerduty.com',
};

const PAGE_SIZE = 100;
const MAX_CLASSIC_OFFSET = 10000; // PagerDuty rejects offset + limit beyond this
const MAX_RANGE_MS = 90 * 24 * 3600 * 1000; // API caps since/until at 6 months; stay well inside
const MAX_RETRIES = 6;

export class PdError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

interface RawAlert {
  id: string;
  status: string;
  summary?: string;
  severity?: string;
  created_at: string;
  html_url: string;
  service?: { id: string; summary: string };
  incident?: { id: string; summary: string; html_url: string };
  body?: { details?: unknown; cef_details?: Record<string, unknown> };
}

interface AlertsPage {
  alerts: RawAlert[];
  more: boolean;
  offset: number;
  limit: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

async function getPage(
  region: Region,
  token: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<AlertsPage> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BASE[region]}/alerts?${params}`, {
        signal,
        headers: {
          Authorization: `Token token=${token}`,
          Accept: 'application/vnd.pagerduty+json;version=2',
        },
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new PdError('Network error talking to PagerDuty (check connectivity / region).');
    }
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await sleep(2000 * (attempt + 1), signal);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (res.status >= 500 && attempt < 2) {
        await sleep(1000 * (attempt + 1), signal);
        continue;
      }
      throw new PdError(`PagerDuty returned HTTP ${res.status}.`, res.status);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = [body?.error?.message, ...(body?.error?.errors ?? [])].filter(Boolean).join(' – ');
      } catch {
        /* ignore */
      }
      if (res.status === 401) detail = 'Invalid or unauthorized API token.';
      throw new PdError(detail || `PagerDuty returned HTTP ${res.status}.`, res.status);
    }
    return res.json();
  }
}

export interface FetchAlertsOptions {
  token: string;
  region: Region;
  since: Date;
  until: Date;
  statuses: AlertStatus[];
  signal?: AbortSignal;
  onProgress?: (count: number) => void;
}

/**
 * Downloads all alerts in [since, until]. Pages with limit/offset; if a window would exceed the
 * API's offset ceiling it is bisected in time and re-fetched. Results are de-duplicated by id.
 */
export async function fetchAlerts(opts: FetchAlertsOptions): Promise<AlertRecord[]> {
  const { token, region, statuses, signal, onProgress } = opts;
  const byId = new Map<string, RawAlert>();

  async function fetchWindow(sinceMs: number, untilMs: number): Promise<void> {
    const found: RawAlert[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        since: new Date(sinceMs).toISOString(),
        until: new Date(untilMs).toISOString(),
      });
      for (const s of statuses) params.append('statuses[]', s);
      const page = await getPage(region, token, params, signal);
      found.push(...page.alerts);
      if (!page.more) break;
      if (offset + 2 * PAGE_SIZE > MAX_CLASSIC_OFFSET && untilMs - sinceMs > 2000) {
        const mid = Math.floor((sinceMs + untilMs) / 2);
        await fetchWindow(sinceMs, mid);
        await fetchWindow(mid, untilMs);
        return;
      }
    }
    for (const a of found) byId.set(a.id, a);
    onProgress?.(byId.size);
  }

  const end = opts.until.getTime();
  for (let start = opts.since.getTime(); start < end; start += MAX_RANGE_MS) {
    await fetchWindow(start, Math.min(start + MAX_RANGE_MS, end));
  }
  return [...byId.values()].map(toRecord);
}

// ---- field extraction -------------------------------------------------------------------------

/** CEF keys that PagerDuty exposes under shorter names in the alert-grouping UI. */
const CEF_RENAMES: Record<string, string> = {
  description: 'summary',
  source_origin: 'source',
  source_component: 'component',
  service_group: 'group',
  event_class: 'class',
};
/** CEF keys that are bookkeeping/duplicates rather than content. */
const CEF_SKIP = new Set(['mutations', 'contexts', 'version', 'creation_time', 'dedup_key', 'message']);

function flatten(value: unknown, path: string, out: Record<string, string>) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (value.length) out[path] = JSON.stringify(value);
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path}.${k}` : k, out);
    return;
  }
  const s = String(value);
  if (s.trim() !== '') out[path] = s;
}

export function extractFields(a: RawAlert): Record<string, string> {
  const out: Record<string, string> = {};
  const cef = a.body?.cef_details;
  if (cef) {
    for (const [k, v] of Object.entries(cef)) {
      if (CEF_SKIP.has(k)) continue;
      flatten(v, CEF_RENAMES[k] ?? k, out);
    }
  } else {
    if (a.summary) out.summary = a.summary;
    if (a.severity) out.severity = a.severity;
    flatten(a.body?.details, 'details', out);
  }
  return out;
}

export function toRecord(a: RawAlert): AlertRecord {
  return {
    id: a.id,
    status: a.status,
    severity: a.severity ?? '',
    summary: a.summary ?? '',
    createdAt: a.created_at,
    createdMs: Date.parse(a.created_at),
    htmlUrl: a.html_url,
    serviceId: a.service?.id ?? 'unknown',
    serviceName: a.service?.summary ?? 'Unknown service',
    incidentId: a.incident?.id ?? null,
    incidentSummary: a.incident?.summary ?? null,
    incidentUrl: a.incident?.html_url ?? null,
    fields: extractFields(a),
  };
}
