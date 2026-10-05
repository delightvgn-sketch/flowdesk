"use client";

import { Copy, Crown, Link2, MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormDialog, FormDialogBody, FormDialogFooter } from "@/components/shared/form-dialog";
import { FormField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/misc";
import { OptionSelect } from "@/components/shared/option-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation, transferOwnership } from "@/features/settings/actions";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { useZodForm } from "@/hooks/use-zod-form";
import { ROLE_META } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { canManageMember } from "@/lib/permissions";
import { inviteSchema } from "@/lib/validation";
import type { WorkspaceRole } from "@/server/db/schema";

type Member = { id: string; profileId: string; fullName: string; email: string; avatarUrl: string | null; role: WorkspaceRole; title: string | null; clientName: string | null; createdAt: Date };
type Invite = { id: string; email: string; role: WorkspaceRole; expiresAt: Date; clientName: string | null };

export function TeamManager({
  members,
  invites,
  role,
  currentProfileId,
  clients,
}: {
  members: Member[];
  invites: Invite[];
  role: WorkspaceRole;
  currentProfileId: string;
  clients: { id: string; label: string }[];
}) {
  const router = useRouter();
  const manage = role === "OWNER" || role === "ADMIN";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "transfer"; member: Member } | null>(null);
  const refresh = () => router.refresh();

  const setRole = useAction(changeMemberRole, { success: "Role updated.", onSuccess: refresh });
  const remove = useAction(removeMember, { success: "Member removed.", onSuccess: () => { setConfirm(null); refresh(); } });
  const transfer = useAction(transferOwnership, { success: "Ownership transferred.", onSuccess: () => { setConfirm(null); refresh(); } });
  const revoke = useAction(revokeInvitation, { success: "Invitation revoked.", onSuccess: refresh });

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card shadow-xs">
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Members</h2>
            <p className="text-xs text-muted-foreground">{members.length} people in this workspace</p>
          </div>
          {manage && (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite
            </Button>
          )}
        </header>
        {lastLink && (
          <div className="flex flex-col gap-2 border-b bg-brand-soft/40 px-5 py-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm">
              <Link2 className="mr-1.5 inline size-4 text-primary" aria-hidden />
              Invitation created. Email delivery is simulated in this build — copy the link and send it yourself.
            </p>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(lastLink).then(() => toast.success("Invite link copied."))}>
              <Copy /> Copy link
            </Button>
          </div>
        )}
        <ul className="divide-y">
          {members.map((m) => {
            const isMe = m.profileId === currentProfileId;
            const editable = manage && !isMe && canManageMember(role, m.role);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <UserAvatar name={m.fullName} src={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.fullName} {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                    {m.title && ` · ${m.title}`}
                    {m.clientName && ` · ${m.clientName}`}
                  </p>
                </div>
                <span className="hidden text-xs text-muted-foreground md:block">Joined {formatDate(m.createdAt)}</span>
                {editable && m.role !== "CLIENT" ? (
                  <Select value={m.role} onValueChange={(v) => setRole.execute({ memberId: m.id, role: v as "ADMIN" | "MEMBER" })}>
                    <SelectTrigger size="sm" className="w-28" aria-label={`Role for ${m.fullName}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge kind="role" value={m.role} />
                )}
                {editable || (role === "OWNER" && !isMe && m.role !== "CLIENT") ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.fullName}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {role === "OWNER" && m.role !== "CLIENT" && (
                        <DropdownMenuItem onSelect={() => setConfirm({ kind: "transfer", member: m })}>
                          <Crown /> Make owner
                        </DropdownMenuItem>
                      )}
                      {editable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: "remove", member: m })}>
                            <Trash2 /> Remove from workspace
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="size-8" />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {manage && invites.length > 0 && (
        <section className="rounded-xl border bg-card shadow-xs">
          <header className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Pending invitations</h2>
          </header>
          <ul className="divide-y">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_META[inv.role].label}
                    {inv.clientName && ` for ${inv.clientName}`} · expires {formatDate(inv.expiresAt)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke.execute({ id: inv.id })}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <h2 className="mb-3 text-sm font-semibold">Roles</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(ROLE_META) as WorkspaceRole[]).map((r) => (
            <div key={r} className="rounded-lg bg-muted/40 p-3">
              <dt><StatusBadge kind="role" value={r} /></dt>
              <dd className="mt-1.5 text-xs text-muted-foreground">{ROLE_META[r].description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} clients={clients} onInvited={(url) => { setLastLink(url); refresh(); }} />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Remove ${confirm?.member.fullName}?`}
        description="They'll immediately lose access to this workspace. Their past work stays."
        confirmLabel="Remove member"
        pending={remove.pending}
        onConfirm={() => confirm && remove.execute({ memberId: confirm.member.id })}
      />
      <ConfirmDialog
        open={confirm?.kind === "transfer"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Make ${confirm?.member.fullName} the owner?`}
        description="They'll get full control of the workspace, including deleting it. You'll become an admin."
        confirmLabel="Transfer ownership"
        destructive={false}
        pending={transfer.pending}
        onConfirm={() => confirm && transfer.execute({ memberId: confirm.member.id })}
      />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, clients, onInvited }: { open: boolean; onOpenChange: (o: boolean) => void; clients: { id: string; label: string }[]; onInvited: (url: string) => void }) {
  const form = useZodForm(inviteSchema, { email: "", role: "MEMBER", clientId: null });
  const role = form.watch("role");
  const { execute, pending } = useAction(inviteMember, {
    success: "Invitation created.",
    onSuccess: ({ url }) => {
      onOpenChange(false);
      form.reset({ email: "", role: "MEMBER", clientId: null });
      onInvited(url);
    },
    onError: (r) => applyFieldErrors(form, r.fieldErrors),
  });
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Invite someone" description="They'll join when they sign in with this email address." className="sm:max-w-md">
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((v) => execute(v))}>
        <FormDialogBody>
          <FormField control={form.control} name="email" label="Email" required render={({ field, props }) => <Input {...field} {...props} type="email" placeholder="name@company.co.ke" autoFocus />} />
          <FormField
            control={form.control}
            name="role"
            label="Role"
            description={ROLE_META[role ?? "MEMBER"].description}
            render={({ field, props }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger {...props} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="CLIENT">Client (portal access)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {role === "CLIENT" && (
            <FormField control={form.control} name="clientId" label="Client" required render={({ field, props }) => <OptionSelect {...props} options={clients} value={field.value} onChange={field.onChange} placeholder="Which client do they represent?" />} />
          )}
        </FormDialogBody>
        <FormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <SubmitButton pending={pending}>Create invitation</SubmitButton>
        </FormDialogFooter>
      </form>
    </FormDialog>
  );
}
