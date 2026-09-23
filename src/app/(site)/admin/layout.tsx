import type { ReactNode } from "react";

// Admin chrome (full-width hero + section rail) is provided per page by
// <AdminShell> so the hero can span the full width while only the body splits
// into rail + content. This layout is a passthrough.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
