"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import {
  SOCIAL_PROVIDER_ORDER,
  type SocialProviderId,
} from "@/lib/social-providers";

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

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.875 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953h-1.514c-1.491 0-1.955.925-1.955 1.874V12h3.328l-.532 3.469h-2.796v8.385A12.003 12.003 0 0 0 24 12z"
      />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#000000"
        fillOpacity="0.9"
        d="M12 3C6.477 3 2 6.463 2 10.735c0 2.76 1.86 5.18 4.656 6.546l-1.18 4.37a.3.3 0 0 0 .457.33l5.02-3.34c.347.03.697.046 1.047.046 5.523 0 10-3.463 10-7.952S17.523 3 12 3z"
      />
    </svg>
  );
}

const PROVIDER_UI: Record<
  SocialProviderId,
  { label: string; Icon: () => React.JSX.Element }
> = {
  google: { label: "Google", Icon: GoogleIcon },
  microsoft: { label: "Microsoft", Icon: MicrosoftIcon },
  facebook: { label: "Facebook", Icon: FacebookIcon },
  kakao: { label: "Kakao", Icon: KakaoIcon },
};

export function SocialButtons() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 서버에 설정된 공급자만 노출한다. 응답 전에는 항상 설정돼 있는 Google 만 보여 준다.
  const [providers, setProviders] = useState<SocialProviderId[]>(["google"]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/auth/providers", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: { providers?: SocialProviderId[] } } | null) => {
        if (Array.isArray(body?.data?.providers)) setProviders(body.data.providers);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const social = async (provider: SocialProviderId) => {
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
      {SOCIAL_PROVIDER_ORDER.filter((id) => providers.includes(id)).map((id) => {
        const { label, Icon } = PROVIDER_UI[id];
        return (
          <Button
            key={id}
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => social(id)}
          >
            <Icon />
            Continue with {label}
          </Button>
        );
      })}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
