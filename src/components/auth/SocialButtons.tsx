"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M16.37 12.77c.03 3.26 2.86 4.35 2.89 4.36-.02.08-.45 1.55-1.49 3.06-.9 1.31-1.83 2.61-3.3 2.64-1.44.03-1.91-.86-3.56-.86s-2.17.83-3.54.89c-1.42.05-2.5-1.42-3.4-2.72C2.1 17.47.71 12.6 2.6 9.39a5.27 5.27 0 0 1 4.45-2.7c1.39-.03 2.7.94 3.55.94.85 0 2.44-1.16 4.12-.99.7.03 2.67.28 3.94 2.14-.1.06-2.35 1.37-2.29 3.99zM13.65 4.87c.75-.91 1.26-2.17 1.12-3.43-1.08.04-2.39.72-3.16 1.63-.7.8-1.31 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z" />
    </svg>
  );
}

export function SocialButtons() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const social = async (provider: "google" | "apple") => {
    setError(null);
    setPending(provider);
    const { error } = await signIn.social({ provider, callbackURL: "/" });
    if (error) {
      setError(
        error.message ?? "Social sign-in failed. Please try again later.",
      );
      setPending(null);
    }
  };

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => social("google")}
      >
        <GoogleIcon />
        Continue with Google
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => social("apple")}
      >
        <AppleIcon />
        Continue with Apple
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
