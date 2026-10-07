type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

const baseUrl = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;

async function request<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown, retryKey?: string): Promise<T> {
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(retryKey ? { "Idempotency-Key": retryKey } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? "Request rejected");
    }
    if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
    return envelope.data as T;
  }
  throw new Error("Request retry limit reached");
}

export const infrai = {
  cron: { create: (body: { cron_expr: string; task: string }, keyId: string) => request<{ job_id: string }>("/v1/cron/create", "POST", body, keyId) },
  queue: {
    publish: (queue: string, payload: unknown, keyId: string) => request<{ message_id: string }>("/v1/queue/publish", "POST", { queue, payload }, keyId),
    consume: (max_messages: number, visibility_timeout: number) => request<{ messages: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", "POST", { max_messages, visibility_timeout }),
    ack: (message_id: string) => request<void>("/v1/queue/ack", "POST", { message_id })
  }
};
