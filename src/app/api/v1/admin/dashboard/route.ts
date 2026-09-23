import { adminDashboard } from "@/server/admin/dashboard-runtime";

export async function GET(request: Request) {
  return adminDashboard(request);
}
