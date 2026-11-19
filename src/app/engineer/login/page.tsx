import React from "react";
import { redirect } from "next/navigation";
import { getEngineerSession } from "@/lib/auth";
import { PublicShell } from "@/components/SiteChrome";
import { EngineerLoginForm } from "@/components/auth/EngineerLoginForm";

export const dynamic = "force-dynamic";

export default async function EngineerLoginPage() {
  const session = await getEngineerSession();
  if (session) {
    redirect("/engineer");
  }

  return (
    <PublicShell>
      <EngineerLoginForm />
    </PublicShell>
  );
}

