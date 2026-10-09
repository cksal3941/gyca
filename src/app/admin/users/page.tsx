import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/dal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/admin/ActionButton";
import {
  banUser,
  revokeUserSessions,
  setUserRole,
  unbanUser,
} from "./actions";

function RoleBadge({ role }: { role?: string | null }) {
  if (role === "admin") {
    return (
      <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-semibold text-brand-blue">
        admin
      </span>
    );
  }
  return (
    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-neutral-500">
      user
    </span>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const session = await requireAdmin();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const { users, total } = await auth.api.listUsers({
    query: {
      limit: 50,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(search
        ? {
            searchValue: search,
            searchField: "email" as const,
            searchOperator: "contains" as const,
          }
        : {}),
    },
    headers: await headers(),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          Users <span className="text-sm font-normal text-neutral-400">({total})</span>
        </h2>
        <form className="flex gap-2" action="/admin/users">
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search by email"
            className="w-56"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] text-left text-[12px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === session.user.id;
              return (
                <tr key={u.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium leading-tight">
                      {u.name}
                      {isSelf && (
                        <span className="ml-1.5 text-[11px] text-neutral-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-neutral-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        banned
                      </span>
                    ) : (
                      <span className="text-[12px] text-neutral-400">active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-neutral-500">
                    {new Date(u.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    {!isSelf && (
                      <div className="flex justify-end gap-1.5">
                        <ActionButton
                          action={setUserRole.bind(
                            null,
                            u.id,
                            u.role === "admin" ? "user" : "admin",
                          )}
                        >
                          {u.role === "admin" ? "Remove admin" : "Make admin"}
                        </ActionButton>
                        <ActionButton
                          action={(u.banned ? unbanUser : banUser).bind(
                            null,
                            u.id,
                          )}
                        >
                          {u.banned ? "Unban" : "Ban"}
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          action={revokeUserSessions.bind(null, u.id)}
                        >
                          Revoke sessions
                        </ActionButton>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-neutral-400"
                >
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
