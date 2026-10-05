import type { Metadata } from "next";

import { DeleteWorkspace, Section, WorkspaceForm } from "@/features/settings/components/settings-forms";
import { can } from "@/lib/permissions";
import { requireStaffContext } from "@/server/auth/session";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireStaffContext();
  const w = ctx.workspace;
  const editable = can(ctx.role, "workspace:update");
  return (
    <div className="space-y-6">
      <Section title="Workspace" description={editable ? "Details used on invoices and across the workspace." : "Only owners and admins can change these settings."}>
        <WorkspaceForm
          readOnly={!editable}
          workspace={{ name: w.name, email: w.email, phone: w.phone, address: w.address, currency: w.currency, timezone: w.timezone, invoicePrefix: w.invoicePrefix, defaultTaxRate: w.defaultTaxRate }}
        />
      </Section>
      {can(ctx.role, "workspace:delete") && (
        <Section title="Danger zone" className="border-danger/30">
          <DeleteWorkspace name={w.name} isDemo={w.isDemo} />
        </Section>
      )}
    </div>
  );
}
