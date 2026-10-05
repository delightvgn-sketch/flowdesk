import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  FolderOpen,
  Lock,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "FlowDesk — Run your client work from one place" },
};

const FEATURES = [
  { icon: Users, title: "Client CRM", body: "Leads, contacts, notes and tags — with every project, invoice and conversation one click away." },
  { icon: FolderKanban, title: "Projects & milestones", body: "Budgets, deadlines, teams and a visual timeline your clients can follow and sign off." },
  { icon: CheckSquare, title: "Tasks that move", body: "A drag-and-drop board with labels, comments and attachments — fully keyboard accessible." },
  { icon: FileText, title: "Invoices & payments", body: "VAT-ready invoices in KSh, PDF export, share links and M-Pesa, bank and card payment records." },
  { icon: FolderOpen, title: "Files", body: "Folders, links to clients and projects, and explicit sharing with clients. Nothing leaks by accident." },
  { icon: MessagesSquare, title: "Messages", body: "Project and client threads, plus internal notes your clients never see." },
  { icon: CalendarDays, title: "Calendar", body: "Meetings, milestones, task and invoice due dates in a month, week or agenda view." },
  { icon: BarChart3, title: "Analytics", body: "Revenue, cash collected, delayed projects and team workload — from live data, not guesses." },
];

const WORKFLOW = [
  { step: "01", title: "Win the client", body: "Capture a lead, keep notes and contacts, and move them to active." },
  { step: "02", title: "Plan the work", body: "Spin up a project with a budget, team, milestones and tasks." },
  { step: "03", title: "Deliver together", body: "Track progress on the board while the client follows along in their portal." },
  { step: "04", title: "Get paid", body: "Invoice from the project, share a link or PDF, and record the payment." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="FlowDesk home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#portal" className="hover:text-foreground">Client portal</a>
            <a href="#ai" className="hover:text-foreground">AI</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)]" />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden /> For freelancers, agencies & small teams
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Run your client work <span className="font-display font-normal text-primary italic">from one place.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
              FlowDesk brings your clients, projects, tasks, invoices, files and conversations together — with a portal your clients will actually use.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/sign-up">
                  Get started <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/demo">View demo</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No setup — the demo signs you in as a real team member.</p>
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rounded-2xl border bg-card p-1.5 shadow-lg sm:p-2">
              <Image
                src="/marketing/dashboard.png"
                alt="FlowDesk dashboard showing revenue, outstanding invoices, active projects and a revenue chart"
                width={2880}
                height={1800}
                priority
                sizes="(min-width: 1152px) 1120px, 100vw"
                className="rounded-xl border dark:hidden"
              />
              <Image
                src="/marketing/dashboard-dark.png"
                alt="FlowDesk dashboard in dark mode"
                width={2880}
                height={1800}
                sizes="(min-width: 1152px) 1120px, 100vw"
                className="hidden rounded-xl border dark:block"
              />
            </div>
          </div>
        </section>

        {/* Overview */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-end">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Stop stitching together <span className="font-display font-normal italic">spreadsheets, chats and invoicing apps.</span>
            </h2>
            <p className="text-muted-foreground">
              Client work lives in too many places. FlowDesk is a single, fast workspace where a lead becomes a project, the project becomes tasks, and finished work becomes a paid invoice — with your client kept in the loop the whole way.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-y bg-card/50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-sm font-medium text-primary">Everything in one workspace</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">The tools you use every day, designed to work together.</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-card p-6">
                  <f.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-medium text-primary">Workflow</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">From first call to final payment.</h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {WORKFLOW.map((w) => (
              <li key={w.step} className="relative border-t-2 border-primary/30 pt-5">
                <span className="tabular text-sm font-semibold text-primary">{w.step}</span>
                <h3 className="mt-2 font-semibold">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 overflow-hidden rounded-2xl border bg-muted/40 p-1.5 shadow-sm sm:p-2">
            <Image src="/marketing/board.png" alt="Kanban task board with To do, In progress, Review and Done columns" width={2384} height={1200} sizes="(min-width: 1152px) 1120px, 100vw" className="rounded-xl border" />
          </div>
        </section>

        {/* Analytics */}
        <section className="border-y bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <p className="text-sm font-medium text-primary">Analytics</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Know where the money is.</h2>
              <p className="mt-4 text-muted-foreground">
                See what you&apos;ve invoiced versus what you&apos;ve actually collected, which clients drive revenue, which projects are slipping and who on the team is overloaded.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {["Revenue by month and by client", "Outstanding and overdue balances", "Delayed projects, flagged automatically", "Workload by teammate"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckSquare className="size-4 shrink-0 text-primary" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border bg-card p-1.5 shadow-md">
              <Image src="/marketing/analytics.png" alt="Analytics showing revenue KPIs, revenue by month and revenue per client" width={2384} height={1040} sizes="(min-width: 1024px) 640px, 100vw" className="rounded-xl" />
            </div>
          </div>
        </section>

        {/* Portal */}
        <section id="portal" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="order-2 overflow-hidden rounded-2xl border bg-card p-1.5 shadow-md lg:order-1">
            <Image src="/marketing/portal.png" alt="Client portal showing a pending approval, project progress and invoices" width={2880} height={1800} sizes="(min-width: 1024px) 640px, 100vw" className="rounded-xl" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-medium text-primary">Client portal</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">A calm, branded space for your clients.</h2>
            <p className="mt-4 text-muted-foreground">
              Clients see their projects, milestones, shared files, invoices and messages — and approve deliverables with one click. They never see your internal notes, other clients or your finances.
            </p>
            <p className="mt-6 flex items-start gap-2 rounded-lg border bg-card p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Access is enforced in the database with row-level security, not just hidden in the interface.
            </p>
          </div>
        </section>

        {/* AI */}
        <section id="ai" className="scroll-mt-20 border-y bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="size-4" aria-hidden /> FlowDesk AI
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">An assistant that knows your workspace.</h2>
              <p className="mt-4 text-muted-foreground">
                Ask about a client before a call, find projects that are slipping, break a brief into tasks, turn messy meeting notes into decisions and action items, or polish an invoice line.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">It only reads data the person asking is allowed to see.</p>
            </div>
            <figure className="rounded-2xl border bg-card p-5 shadow-md" aria-label="Example conversation with FlowDesk AI">
              <div className="flex justify-end">
                <p className="max-w-xs rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">Which projects appear to be delayed?</p>
              </div>
              <div className="mt-4 flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <div className="space-y-2 text-sm">
                  <p className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">Checked active projects</p>
                  <p>Two projects need attention:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li><strong>Booking Platform</strong> (Savannah Safaris) is past its due date at 33% — the second channel-manager integration is blocked.</li>
                    <li><strong>Brand Website</strong> (Nova Interiors) is in review, 3 days late, with changes requested on the About page.</li>
                  </ul>
                </div>
              </div>
              <figcaption className="mt-4 text-center text-xs text-muted-foreground">Illustrative example based on the demo workspace.</figcaption>
            </figure>
          </div>
        </section>

        {/* Engineering */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Secure by design", body: "Clerk authentication, server-side authorization on every action, and Postgres row-level security per workspace and role." },
              { icon: FileText, title: "Numbers you can trust", body: "Invoice totals are always recalculated on the server in integer cents. The browser's numbers are never stored." },
              { icon: Sparkles, title: "Fast and accessible", body: "Server-rendered pages, keyboard-friendly drag and drop, real focus management and a dark mode designed on purpose." },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border bg-card p-6 shadow-xs">
                <c.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See it with real-looking data.</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">Step into a Nairobi studio&apos;s workspace as the owner, a developer or a client — no sign-up needed.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/demo">View demo</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:bg-transparent">
                <Link href="/sign-up">Create your workspace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo compact />
          <p>A portfolio project · Built with Next.js, Supabase, Clerk and Vercel</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/demo" className="hover:text-foreground">Demo</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
