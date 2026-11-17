import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { ClientLoginForm } from "@/components/auth/ClientLoginForm";

export const dynamic = "force-dynamic";

export default async function ClientLoginPage() {
  return (
    <PublicShell>
      <ClientLoginForm />
    </PublicShell>
  );
}
