import { PageHeader } from "@/components/shared/page-header";
import { requireStaffContext } from "@/server/auth/session";

export default async function DashboardPage() {
  const ctx = await requireStaffContext();
  return <PageHeader title={`Good day, ${ctx.profile.fullName.split(" ")[0]}`} description={ctx.workspace.name} />;
}
