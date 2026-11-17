import React from "react";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const adminRecord = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true },
  });
  if (!adminRecord) {
    redirect("/admin/login");
  }

  return <AdminDashboardClient adminEmail={adminRecord.email} adminRole={adminRecord.role} />;
}

