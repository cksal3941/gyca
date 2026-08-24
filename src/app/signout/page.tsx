"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOut, useSession } from "@/lib/auth-client";

export default function SignOutPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [busy, setBusy] = useState(false);

  const onSignOut = async () => {
    setBusy(true);
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <Link
          href="/"
          className="font-title mb-6 block text-3xl tracking-wide text-brand-blue"
        >
          GYCA
        </Link>
        <Card>
          <CardContent className="grid gap-4 py-8">
            {isPending ? null : session ? (
              <>
                <h1 className="text-lg font-semibold">
                  Are you sure you want to sign out?
                </h1>
                <p className="text-sm text-muted-foreground">
                  You are signed in as{" "}
                  <span className="font-medium text-foreground">
                    {session.user.email}
                  </span>
                  .
                </p>
                <Button
                  onClick={onSignOut}
                  disabled={busy}
                  className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
                >
                  {busy ? "Signing out..." : "Sign out"}
                </Button>
                <Link
                  href="/"
                  className="text-xs text-muted-foreground hover:text-brand-blue hover:underline"
                >
                  Cancel and go back home
                </Link>
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold">
                  You are not signed in
                </h1>
                <p className="text-sm text-muted-foreground">
                  There is no active session on this device.
                </p>
                <Button
                  asChild
                  className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
                >
                  <Link href="/login">Go to sign in</Link>
                </Button>
                <Link
                  href="/"
                  className="text-xs text-muted-foreground hover:text-brand-blue hover:underline"
                >
                  Back to home
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
