import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-6">
        <Link href="/" aria-label="FlowDesk home">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <p className="font-display text-7xl text-primary italic sm:text-8xl">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">This page has wandered off</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or belongs to a workspace you don&apos;t have access to.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">
              <Compass /> Go to your dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">FlowDesk home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
