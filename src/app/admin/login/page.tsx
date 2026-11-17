import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  return (
    <PublicShell>
      <AdminLoginForm />
    </PublicShell>
  );
}
