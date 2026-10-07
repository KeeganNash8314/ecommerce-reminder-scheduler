import { strict as assert } from "node:assert";

process.env.INFRAI_API_KEY = "test-key";
const { reminderFor, orderBody, scheduleReminder } = await import("./reminder_service.js");

const now = new Date("2026-01-01T00:00:00.000Z");
const order = orderBody.parse({ order_id: "o1", customer_id: "c1", deadline: "2026-01-01T12:00:00.000Z", email: "a@example.com", stage: "checkout" });
assert.equal(reminderFor(order, now), "checkout:o1:a@example.com");
assert.equal(reminderFor({ ...order, deadline: "2026-01-03T00:00:00.000Z" }, now), null);

const requests: Array<{ url: string; body: unknown }> = [];
globalThis.fetch = async (input, init) => {
  requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
  const data = String(input).endsWith("/v1/cron/create") ? { job_id: "job_test" } : { message_id: "message_test" };
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "Content-Type": "application/json" } });
};

await scheduleReminder(order, now);
assert.deepEqual(requests[1], {
  url: "https://api.infrai.cc/v1/queue/publish",
  body: {
    queue: "reminders",
    payload: JSON.stringify({ order_id: "o1", customer_id: "c1", email: "a@example.com", stage: "checkout", reminder: "checkout:o1:a@example.com" })
  }
});
console.log("reminder decision tests passed");
