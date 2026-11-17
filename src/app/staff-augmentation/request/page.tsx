import React, { Suspense } from "react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { StaffAugRequestForm } from "@/components/StaffAugRequestForm";

export const dynamic = "force-dynamic";

export default function StaffAugmentationRequestPage() {
  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Talent Bench", href: "/talent" },
          { label: "Request Engineers" },
        ]}
        eyebrow="Staff Augmentation Intake"
        title="Request Engineering or Management Talent"
        subtitle="Submit your structured requirements below. Our delivery team will match vetted specialists and contact you under NDA."
      />
      <section className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Suspense fallback={<div className="p-8 text-center text-sm">Loading request form...</div>}>
            <StaffAugRequestForm />
          </Suspense>
        </div>
      </section>
    </PublicShell>
  );
}
