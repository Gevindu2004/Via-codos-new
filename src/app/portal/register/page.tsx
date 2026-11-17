import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { ClientRegisterForm } from "@/components/auth/ClientRegisterForm";

export const dynamic = "force-dynamic";

export default async function ClientRegisterPage() {
  return (
    <PublicShell>
      <ClientRegisterForm />
    </PublicShell>
  );
}
