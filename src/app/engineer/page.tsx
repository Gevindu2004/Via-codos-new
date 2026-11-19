import React from "react";
import { redirect } from "next/navigation";
import { getEngineerSession } from "@/lib/auth";
import { findEngineerAccountById } from "@/lib/engineer-store";
import { PublicShell } from "@/components/SiteChrome";
import { EngineerPortalDashboard } from "@/components/engineer/EngineerPortalDashboard";

export const dynamic = "force-dynamic";

export default async function EngineerPortalPage() {
  const session = await getEngineerSession();
  if (!session) {
    redirect("/engineer/login");
  }

  const account = await findEngineerAccountById(session.engineerId);
  if (!account || account.status !== "ACTIVE") {
    redirect("/engineer/login");
  }

  return (
    <PublicShell>
      <EngineerPortalDashboard />
    </PublicShell>
  );
}

