"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";

type Tab = "profile" | "security" | "sessions" | "account";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "sessions", label: "Sessions" },
  { key: "account", label: "Account" },
];

function Avatar({
  name,
  image,
  size = 64,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="rounded-full border border-black/10 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-blue font-nav font-semibold text-white uppercase"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name?.trim()?.charAt(0) || "?"}
    </span>
  );
}

function Notice({ kind, text }: { kind: "ok" | "err"; text: string }) {
  return (
    <p
      className={`text-xs ${kind === "ok" ? "text-green-600" : "text-destructive"}`}
    >
      {text}
    </p>
  );
}

/* ---------- Profile ---------- */

function ProfileSection() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user.name ?? "");
  const [image, setImage] = useState(session?.user.image ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) {
      setName(session.user.name);
      setImage(session.user.image ?? "");
    }
  }, [session]);

  if (!session) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { error } = await authClient.updateUser({
      name,
      image: image.trim() || undefined,
    });
    setBusy(false);
    setMsg(
      error
        ? { kind: "err", text: error.message ?? "Failed to update profile." }
        : { kind: "ok", text: "Profile updated." },
    );
  };

  return (
    <Card>
      <CardContent className="grid gap-6 py-6">
        <div>
          <h2 className="text-base font-semibold">Public profile</h2>
          <p className="text-xs text-muted-foreground">
            How you appear across GYCA.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Avatar name={name || session.user.name} image={image.trim() || null} />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{session.user.email}</p>
            <p>Avatar uses your photo URL below, or your name&apos;s initial.</p>
          </div>
        </div>
        <form onSubmit={save} className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">Profile photo URL</Label>
            <Input
              id="image"
              type="url"
              placeholder="https://example.com/me.png"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>
          {msg && <Notice {...msg} />}
          <Button
            type="submit"
            disabled={busy}
            className="w-fit bg-brand-blue text-white hover:bg-brand-blue/90"
          >
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- Security ---------- */

function SecuritySection({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ kind: "err", text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMsg({ kind: "err", text: "New passwords do not match." });
      return;
    }
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      setMsg({
        kind: "err",
        text:
          error.status === 400
            ? "Current password is incorrect."
            : (error.message ?? "Failed to change password."),
      });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMsg({
      kind: "ok",
      text: "Password changed. Other devices have been signed out.",
    });
  };

  return (
    <Card>
      <CardContent className="grid gap-6 py-6">
        <div>
          <h2 className="text-base font-semibold">Change password</h2>
          <p className="text-xs text-muted-foreground">
            Changing your password signs out your other devices.
          </p>
        </div>
        {hasPassword ? (
          <form onSubmit={change} className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {msg && <Notice {...msg} />}
            <Button
              type="submit"
              disabled={busy}
              className="w-fit bg-brand-blue text-white hover:bg-brand-blue/90"
            >
              {busy ? "Changing..." : "Change password"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            You signed up with a social account, so there is no password on
            this account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Sessions ---------- */

type SessionRow = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
};

function describeAgent(ua?: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "macOS"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

function SessionsSection() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await authClient.listSessions();
    if (error) setErr(error.message ?? "Failed to load sessions.");
    else setRows(data as SessionRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (token: string) => {
    await authClient.revokeSession({ token });
    await load();
  };

  return (
    <Card>
      <CardContent className="grid gap-6 py-6">
        <div>
          <h2 className="text-base font-semibold">Active sessions</h2>
          <p className="text-xs text-muted-foreground">
            Devices currently signed in to your account.
          </p>
        </div>
        {err && <Notice kind="err" text={err} />}
        {!rows ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((r) => {
              const isCurrent = r.token === session?.session.token;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {describeAgent(r.userAgent)}
                      {isCurrent && (
                        <span className="ml-2 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
                          This device
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.ipAddress || "unknown IP"} · signed in{" "}
                      {new Date(r.createdAt).toLocaleString("en-US")}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revoke(r.token)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Account ---------- */

type AccountRow = {
  id: string;
  providerId: string;
  createdAt: Date | string;
};

const PROVIDER_LABEL: Record<string, string> = {
  credential: "Email & password",
  google: "Google",
  apple: "Apple",
};

function AccountSection({
  accounts,
  hasPassword,
}: {
  accounts: AccountRow[];
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setMsg(null);
    setBusy(true);
    const { error } = await authClient.deleteUser(
      hasPassword ? { password } : {},
    );
    setBusy(false);
    if (error) {
      setMsg({
        kind: "err",
        text: error.message ?? "Failed to delete account.",
      });
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4 py-6">
          <div>
            <h2 className="text-base font-semibold">Sign-in methods</h2>
            <p className="text-xs text-muted-foreground">
              Ways you can sign in to this account.
            </p>
          </div>
          <ul className="grid gap-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {PROVIDER_LABEL[a.providerId] ?? a.providerId}
                </span>
                <span className="text-xs text-muted-foreground">
                  connected {new Date(a.createdAt).toLocaleDateString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardContent className="grid gap-4 py-6">
          <div>
            <h2 className="text-base font-semibold text-destructive">
              Danger zone
            </h2>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and all of its data. This cannot
              be undone.
            </p>
          </div>
          <div className="grid max-w-md gap-3">
            {hasPassword && (
              <div className="grid gap-2">
                <Label htmlFor="del-password">Your password</Label>
                <Input
                  id="del-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="del-confirm">
                Type <span className="font-mono font-semibold">DELETE</span> to
                confirm
              </Label>
              <Input
                id="del-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
            {msg && <Notice {...msg} />}
            <Button
              variant="destructive"
              disabled={
                busy ||
                confirmText !== "DELETE" ||
                (hasPassword && !password)
              }
              onClick={remove}
              className="w-fit"
            >
              {busy ? "Deleting..." : "Delete this account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Page ---------- */

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [tab, setTab] = useState<Tab>("profile");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    authClient.listAccounts().then(({ data }) => {
      if (data) setAccounts(data as AccountRow[]);
    });
  }, [session]);

  if (isPending || !session) return null;

  const hasPassword = accounts.some((a) => a.providerId === "credential");

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-[110px]">
        <div className="mb-8 flex items-center gap-4">
          <Avatar name={session.user.name} image={session.user.image} size={48} />
          <div>
            <h1 className="text-xl font-semibold leading-tight">
              {session.user.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Your personal account settings
            </p>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <nav className="flex h-fit flex-row gap-1 overflow-x-auto md:flex-col">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-2 text-left text-sm whitespace-nowrap !transition-none ${
                  tab === t.key
                    ? "bg-brand-blue/10 font-semibold text-brand-blue"
                    : "hover:bg-black/5"
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/signout"
              className="rounded-md px-3 py-2 text-left text-sm whitespace-nowrap text-neutral-500 !transition-none hover:bg-black/5"
            >
              Sign out
            </Link>
          </nav>

          <div>
            {tab === "profile" && <ProfileSection />}
            {tab === "security" && <SecuritySection hasPassword={hasPassword} />}
            {tab === "sessions" && <SessionsSection />}
            {tab === "account" && (
              <AccountSection accounts={accounts} hasPassword={hasPassword} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
