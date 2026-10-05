import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ROLE_META } from "@/lib/constants";
import { DEMO_LOGIN_PERSONAS, DEMO_PEOPLE, DEMO_WORKSPACE } from "@/server/seed/demo-data";

import { DemoPersonaButton } from "./persona-button";

export const metadata: Metadata = { title: "Live demo" };

export default function DemoPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-6">
        <Link href="/" aria-label="FlowDesk home">
          <Logo />
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-16">
        <p className="font-display text-lg text-primary italic">Live demo</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Step inside {DEMO_WORKSPACE.name}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          A small Nairobi studio with real-looking clients, projects, invoices and files. Pick a role to see how FlowDesk changes
          what each person can see and do — permissions are enforced by the database, not just hidden in the UI.
        </p>

        <ul className="mt-8 grid gap-3">
          {DEMO_LOGIN_PERSONAS.map(({ key, blurb }) => {
            const person = DEMO_PEOPLE[key];
            return (
              <li key={key}>
                <DemoPersonaButton
                  persona={key}
                  name={person.fullName}
                  title={person.title}
                  roleLabel={ROLE_META[person.role].label}
                  blurb={blurb}
                />
              </li>
            );
          })}
        </ul>

        <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Demo data is shared by everyone trying FlowDesk and is reset regularly. Payments are records only — no money moves.
        </p>
      </main>
    </div>
  );
}
