import "server-only";

import { sql } from "drizzle-orm";

import type { Tx } from "@/server/db";

const n = (v: unknown) => Number(v ?? 0);

export async function revenueKpis(tx: Tx, ws: string, from: string, today: string) {
  const [r] = await tx.execute<Record<string, string>>(sql`
    select
      coalesce((select sum(amount) from payments where workspace_id = ${ws} and status = 'COMPLETED' and paid_on >= ${from}::date), 0) as collected,
      coalesce((select sum(total) from invoices where workspace_id = ${ws} and status not in ('DRAFT', 'CANCELLED') and issue_date >= ${from}::date), 0) as invoiced,
      (select count(*) from invoices where workspace_id = ${ws} and status = 'PAID' and issue_date >= ${from}::date) as paid_count,
      (select count(*) from invoices where workspace_id = ${ws} and status in ('SENT', 'OVERDUE') and due_date >= ${today}::date) as outstanding_count,
      coalesce((select sum(total - amount_paid) from invoices where workspace_id = ${ws} and status in ('SENT', 'OVERDUE') and due_date >= ${today}::date), 0) as outstanding,
      (select count(*) from invoices where workspace_id = ${ws} and status in ('SENT', 'OVERDUE') and due_date < ${today}::date) as overdue_count,
      coalesce((select sum(total - amount_paid) from invoices where workspace_id = ${ws} and status in ('SENT', 'OVERDUE') and due_date < ${today}::date), 0) as overdue,
      coalesce((select avg(p.paid_on - i.issue_date) from invoices i join lateral (
        select max(paid_on) as paid_on from payments where invoice_id = i.id and status = 'COMPLETED') p on true
        where i.workspace_id = ${ws} and i.status = 'PAID' and i.issue_date >= ${from}::date), 0) as days_to_pay
  `);
  return {
    collected: n(r.collected),
    invoiced: n(r.invoiced),
    paidCount: n(r.paid_count),
    outstanding: n(r.outstanding),
    outstandingCount: n(r.outstanding_count),
    overdue: n(r.overdue),
    overdueCount: n(r.overdue_count),
    daysToPay: Math.round(n(r.days_to_pay)),
  };
}

export async function revenueByClient(tx: Tx, ws: string, from: string) {
  const rows = await tx.execute<{ id: string; name: string; revenue: string }>(sql`
    select c.id, coalesce(c.company, c.name) as name, sum(p.amount) as revenue
    from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = i.client_id
    where p.workspace_id = ${ws} and p.status = 'COMPLETED' and p.paid_on >= ${from}::date
    group by c.id, 2 order by 3 desc limit 8
  `);
  return rows.map((r) => ({ id: r.id, name: r.name, revenue: n(r.revenue) }));
}

export async function clientsByMonth(tx: Tx, ws: string, today: string, months: number) {
  const rows = await tx.execute<{ label: string; added: string }>(sql`
    select to_char(m, 'Mon') as label,
      (select count(*) from clients c where c.workspace_id = ${ws} and date_trunc('month', c.created_at) = m) as added
    from generate_series(date_trunc('month', ${today}::date) - make_interval(months => ${months - 1}), date_trunc('month', ${today}::date), interval '1 month') m
    order by m
  `);
  return rows.map((r) => ({ label: r.label, added: n(r.added) }));
}

export async function clientCounts(tx: Tx, ws: string) {
  const rows = await tx.execute<{ status: string; count: string }>(sql`select status::text, count(*) from clients where workspace_id = ${ws} group by 1`);
  return Object.fromEntries(rows.map((r) => [r.status, n(r.count)])) as Record<string, number>;
}

export async function projectHealth(tx: Tx, ws: string, from: string, today: string) {
  const [r] = await tx.execute<Record<string, string>>(sql`
    select
      count(*) filter (where status in ('PLANNING', 'IN_PROGRESS', 'REVIEW')) as active,
      count(*) filter (where status = 'COMPLETED' and completed_at >= ${from}::date) as completed,
      count(*) filter (where status in ('PLANNING', 'IN_PROGRESS', 'REVIEW') and due_date < ${today}::date) as delayed,
      count(*) filter (where status = 'ON_HOLD') as on_hold
    from projects where workspace_id = ${ws}
  `);
  const byStatus = await tx.execute<{ status: string; count: string }>(sql`select status::text, count(*) from projects where workspace_id = ${ws} group by 1`);
  const delayedList = await tx.execute<{ id: string; name: string; due_date: string; progress: number; client: string | null }>(sql`
    select p.id, p.name, p.due_date::text, p.progress, c.company as client from projects p left join clients c on c.id = p.client_id
    where p.workspace_id = ${ws} and p.status in ('PLANNING', 'IN_PROGRESS', 'REVIEW') and p.due_date < ${today}::date order by p.due_date
  `);
  return {
    active: n(r.active),
    completed: n(r.completed),
    delayed: n(r.delayed),
    onHold: n(r.on_hold),
    byStatus: byStatus.map((s) => ({ status: s.status, count: n(s.count) })),
    delayedList: delayedList.map((d) => ({ ...d, progress: Number(d.progress) })),
  };
}

export async function taskStats(tx: Tx, ws: string, from: string, today: string) {
  const [r] = await tx.execute<Record<string, string>>(sql`
    select
      count(*) filter (where status <> 'DONE') as open,
      count(*) filter (where status <> 'DONE' and due_date < ${today}::date) as overdue,
      count(*) filter (where status = 'DONE' and completed_at >= ${from}::date) as completed,
      coalesce(avg(extract(epoch from completed_at - created_at) / 86400) filter (where status = 'DONE' and completed_at >= ${from}::date), 0) as cycle_days
    from tasks where workspace_id = ${ws}
  `);
  const workload = await tx.execute<{ name: string; open: string; overdue: string }>(sql`
    select coalesce(p.full_name, 'Unassigned') as name, count(*) as open,
      count(*) filter (where t.due_date < ${today}::date) as overdue
    from tasks t left join profiles p on p.id = t.assignee_id
    where t.workspace_id = ${ws} and t.status <> 'DONE' group by 1 order by 2 desc limit 8
  `);
  return {
    open: n(r.open),
    overdue: n(r.overdue),
    completed: n(r.completed),
    cycleDays: Math.round(n(r.cycle_days) * 10) / 10,
    workload: workload.map((w) => ({ name: w.name, open: n(w.open), overdue: n(w.overdue) })),
  };
}
