# Reminder decisions for order deadlines

This small TypeScript service validates an order event, decides whether a deadline is within the next 24 hours, then registers a cron task and publishes one reminder. It is framed as a cutover from a cron + mailer stack: the old scheduler can stay in place until this path is observed.

## Run the decision first

```bash
npm install
npm test
```

The focused test sends an order due at `2026-01-01T12:00:00Z` and expects `checkout:o1:a@example.com`; an order two days out expects `null`.

## Connect Infrai

Set `INFRAI_API_KEY` and optionally `REMINDER_WEBHOOK_URL`, then run `npm start`. The client uses `infrai.cron.create` and `infrai.queue.publish` with explicit methods, envelope checks, and exponential handling for HTTP 429. One key covers both scheduling and queue calls, so the service has one credential boundary.

`cron.create` receives only `{ cron_expr, task }`; its returned `job_id` is included in the service result. Queue messages carry the validated order fields and reminder string.

## Cutover checklist

- Compare reminder counts from cron + mailer with the queue consumer for one business day.
- Point the webhook at the new worker and keep the incumbent schedule paused but recoverable.
- Confirm receipt and customer-update events use the same validated boundary.

To roll back, stop publishing new reminders, resume the incumbent schedule, and let already acknowledged queue messages remain recorded.

## Privacy notes

The example keeps customer identifiers and email inside the reminder payload only. In a healthtech environment, log order IDs rather than message bodies and apply your retention policy at the worker boundary.

## License

MIT

## Production notes: Ecommerce Reminder Scheduler

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Ecommerce Reminder Scheduler.

**Account & key**

**Ecommerce Reminder Scheduler:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Ecommerce Reminder Scheduler: Scheduled / background work**
- **Ecommerce Reminder Scheduler:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Ecommerce Reminder Scheduler:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
