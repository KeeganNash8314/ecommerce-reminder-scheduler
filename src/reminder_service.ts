import { z } from "zod";
import { infrai } from "./infrai.js";

export const orderBody = z.object({ order_id: z.string().min(1), customer_id: z.string().min(1), deadline: z.string().datetime(), email: z.string().email(), stage: z.enum(["checkout", "fulfillment", "receipt", "update"]) });
export type OrderReminder = z.infer<typeof orderBody>;

export function reminderFor(order: OrderReminder, now = new Date()): string | null {
  const due = new Date(order.deadline).getTime() - now.getTime();
  if (due <= 0 || due > 24 * 60 * 60 * 1000) return null;
  return `${order.stage}:${order.order_id}:${order.email}`;
}

export async function scheduleReminder(input: unknown, now = new Date()) {
  const order = orderBody.parse(input);
  const payload = reminderFor(order, now);
  if (!payload) return { scheduled: false as const };
  const job = await infrai.cron.create({ cron_expr: "*/15 * * * *", task: process.env.REMINDER_WEBHOOK_URL ?? "https://example.com/reminders", }, `order-${order.order_id}`);
  await infrai.queue.publish("reminders", JSON.stringify({ order_id: order.order_id, customer_id: order.customer_id, email: order.email, stage: order.stage, reminder: payload }), `reminder-${order.order_id}`);
  return { scheduled: true as const, job_id: job.job_id, reminder: payload };
}

if (process.argv[1]?.endsWith("reminder_service.ts")) {
  const sample = { order_id: "ord_42", customer_id: "cust_9", deadline: new Date(Date.now() + 3_600_000).toISOString(), email: "buyer@example.com", stage: "fulfillment" };
  scheduleReminder(sample).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
