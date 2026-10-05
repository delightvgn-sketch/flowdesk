import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { requireStaffContext } from "@/server/auth/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const ctx = await requireStaffContext();
  return (
    <>
      <PageHeader title="Settings" description={`Your account and the ${ctx.workspace.name} workspace.`} />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <SettingsNav role={ctx.role} />
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </>
  );
}
