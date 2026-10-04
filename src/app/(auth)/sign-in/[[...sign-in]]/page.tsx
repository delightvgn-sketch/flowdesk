import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
      <p className="text-sm text-muted-foreground">
        Just looking around?{" "}
        <Link href="/demo" className="font-medium text-primary underline-offset-4 hover:underline">
          Explore the live demo
        </Link>
      </p>
    </div>
  );
}
