import React from "react";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { ClientPortalDashboard } from "@/components/ClientPortalDashboard";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage() {
  const session = await getClientSession();
  if (!session) {
    redirect("/portal/login");
  }

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Client Portal" }]}
        eyebrow="Staff Augmentation Governance"
        title="Client Hiring Pipeline & Verification Portal"
        subtitle="Track requested talent profiles through Admin Approval, AI Interviews, 3-Way Management Meetings, Electronic Contract Sign-Off, and Placement."
      />
      <section className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ClientPortalDashboard />
        </div>
      </section>
    </PublicShell>
  );
}

