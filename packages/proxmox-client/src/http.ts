import { request as undiciRequest, type Dispatcher } from "undici";
import { createPinnedAgent } from "./tls.js";
import { ProxmoxApiError, ProxmoxAuthError } from "./errors.js";

export interface ProxmoxTicket {
  ticket: string;
  csrfToken: string;
  username: string;
  /** Epoch ms; Proxmox tickets are valid for ~2 hours. */
  expiresAt: number;
}

export interface ProxmoxHttpClientOptions {
  host: string;
  port?: number;
  tlsFingerprint: string;
  /** Reuse an existing pinned agent (e.g. one cached per cluster) instead of creating a new TLS pool. */
  dispatcher?: Dispatcher;
}

type Params = Record<string, string | number | boolean | undefined>;

function toFormBody(params: Params = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.append(key, String(value));
  }
  return search.toString();
}

/**
 * Low-level HTTP transport for a single Proxmox host/cluster endpoint.
 * Holds no long-lived secrets beyond the in-memory ticket for the lifetime of this instance
 * (the server layer is responsible for encrypting it before persisting to a session store).
 */
export class ProxmoxHttpClient {
  readonly baseUrl: string;
  private readonly dispatcher: Dispatcher;
  private ticket: ProxmoxTicket | null = null;

  constructor(private readonly opts: ProxmoxHttpClientOptions) {
    const port = opts.port ?? 8006;
    this.baseUrl = `https://${opts.host}:${port}/api2/json`;
    this.dispatcher = opts.dispatcher ?? createPinnedAgent(opts.tlsFingerprint);
  }

  setTicket(ticket: ProxmoxTicket): void {
    this.ticket = ticket;
  }

  getTicket(): ProxmoxTicket | null {
    return this.ticket;
  }

  clearTicket(): void {
    this.ticket = null;
  }

  /** Authenticates and stores the resulting ticket. Does not require an existing session. */
  async login(username: string, password: string, realm = "pam", otp?: string): Promise<ProxmoxTicket> {
    const body = toFormBody({
      username: `${username}@${realm}`,
      password,
      otp,
    });
    const res = await undiciRequest(`${this.baseUrl}/access/ticket`, {
      method: "POST",
      dispatcher: this.dispatcher,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await res.body.json()) as {
      data?: { ticket: string; CSRFPreventionToken: string; username: string };
      errors?: Record<string, string>;
    };
    if (res.statusCode !== 200 || !payload.data) {
      throw new ProxmoxAuthError("Invalid Proxmox credentials");
    }
    const ticket: ProxmoxTicket = {
      ticket: payload.data.ticket,
      csrfToken: payload.data.CSRFPreventionToken,
      username: payload.data.username,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    this.ticket = ticket;
    return ticket;
  }

  /** Re-authenticates using the current ticket as the password, per Proxmox's documented refresh flow. */
  async refresh(): Promise<ProxmoxTicket> {
    if (!this.ticket) throw new ProxmoxAuthError("No active session to refresh");
    const [username, realm] = splitUserRealm(this.ticket.username);
    return this.login(username, this.ticket.ticket, realm);
  }

  async request<T>(method: string, path: string, params?: Params, extraHeaders?: Record<string, string>): Promise<T> {
    if (!this.ticket) throw new ProxmoxAuthError("Not authenticated");
    const isMutating = method !== "GET";
    const query = !isMutating && params ? `?${toFormBody(params)}` : "";
    const body = isMutating && params ? toFormBody(params) : undefined;

    const res = await undiciRequest(`${this.baseUrl}${path}${query}`, {
      method: method as Dispatcher.HttpMethod,
      dispatcher: this.dispatcher,
      headers: {
        cookie: `PVEAuthCookie=${this.ticket.ticket}`,
        ...(isMutating ? { "CSRFPreventionToken": this.ticket.csrfToken } : {}),
        ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...extraHeaders,
      },
      body,
    });

    const text = await res.body.text();
    const payload = text ? (JSON.parse(text) as { data?: T; errors?: Record<string, string> }) : {};

    if (res.statusCode === 401) throw new ProxmoxAuthError();
    if (res.statusCode >= 400) {
      throw new ProxmoxApiError(
        `Proxmox API error on ${method} ${path}`,
        res.statusCode,
        payload.errors,
      );
    }
    return payload.data as T;
  }

  get<T>(path: string, params?: Params): Promise<T> {
    return this.request<T>("GET", path, params);
  }
  post<T>(path: string, params?: Params, extraHeaders?: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, params, extraHeaders);
  }
  put<T>(path: string, params?: Params): Promise<T> {
    return this.request<T>("PUT", path, params);
  }
  delete<T>(path: string, params?: Params): Promise<T> {
    return this.request<T>("DELETE", path, params);
  }
}

function splitUserRealm(userAtRealm: string): [string, string] {
  const at = userAtRealm.lastIndexOf("@");
  if (at === -1) return [userAtRealm, "pam"];
  return [userAtRealm.slice(0, at), userAtRealm.slice(at + 1)];
}
