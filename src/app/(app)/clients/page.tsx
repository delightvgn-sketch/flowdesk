import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/shared/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, param, parsePage } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientRowActions, NewClientButton } from "@/features/clients/components/client-buttons";
import { listClients, listClientTags, type ClientListFilters } from "@/features/clients/queries";
import { CLIENT_STATUS_META, CLIENT_STATUSES, PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requirePagePermission, requireStaffContext } from "@/server/auth/session";
import type { ClientStatus } from "@/server/db/schema";

export const metadata: Metadata = { title: "Clients" };

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
  { value: "revenue", label: "Revenue" },
];

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const ctx = await requireStaffContext();
  requirePagePermission(ctx, "client:view");
  const sp = await searchParams;

  const status = param(sp.status);
  const filters: ClientListFilters = {
    q: param(sp.q),
    status: CLIENT_STATUSES.includes(status as ClientStatus) ? (status as ClientStatus) : undefined,
    tag: param(sp.tag),
    sort: (SORTS.find((s) => s.value === param(sp.sort))?.value ?? "newest") as ClientListFilters["sort"],
    page: parsePage(sp.page),
  };

  const [{ rows, total }, tags] = await ctx.db((tx) => Promise.all([listClients(tx, ctx.workspace.id, filters), listClientTags(tx, ctx.workspace.id)]));
  const manage = can(ctx.role, "client:manage");
  const filtered = !!(filters.q || filters.status || filters.tag);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Leads, customers and everything you know about them."
        actions={manage && <NewClientButton />}
      />

      <Toolbar>
        <SearchInput placeholder="Search clients…" />
        <FilterSelect param="status" label="Status" options={CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_META[s].label }))} allLabel="All but archived" />
        {tags.length > 0 && <FilterSelect param="tag" label="Tag" options={tags.map((t) => ({ value: t, label: t }))} />}
        <FilterSelect param="sort" label="Sort" options={SORTS.slice(1)} allLabel="Newest" />
        <ClearFilters keys={["q", "status", "tag", "sort"]} />
      </Toolbar>

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={Users} title="No clients match your filters" description="Try a different search or clear the filters." />
        ) : (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to start tracking projects, invoices and conversations in one place."
            action={manage && <NewClientButton />}
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Active projects</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Added</TableHead>
                  {manage && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} className="group relative">
                    <TableCell className="pl-4">
                      <Link href={`/clients/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <UserAvatar name={c.company ?? c.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:underline">{c.company ?? c.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.company ? c.name : c.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell><StatusBadge kind="client" value={c.status} /></TableCell>
                    <TableCell>
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-right">{c.activeProjects}</TableCell>
                    <TableCell className="tabular text-right font-medium">{formatMoney(c.revenue)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    {manage && (
                      <TableCell className="relative z-10 pr-3">
                        <ClientRowActions client={{ ...c, website: null, address: null, notes: null }} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-xs active:bg-muted/50">
                  <UserAvatar name={c.company ?? c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.company ?? c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.company ? c.name : c.email} · {c.activeProjects} active
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <StatusBadge kind="client" value={c.status} />
                    <span className="tabular text-xs font-medium">{formatMoney(c.revenue, { compact: true })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={filters.page} pageSize={PAGE_SIZE} total={total} searchParams={sp} basePath="/clients" />
        </>
      )}
    </>
  );
}
