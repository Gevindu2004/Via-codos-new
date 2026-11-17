import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { SignaturePadClient } from "@/components/SignaturePadClient";

export const dynamic = "force-dynamic";

export default async function ClientSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sigReq = await prisma.signatureRequest.findUnique({
    where: { token },
  });

  if (!sigReq) {
    notFound();
  }

  if (sigReq.status === "PENDING") {
    await prisma.signatureRequest.update({
      where: { id: sigReq.id },
      data: { status: "VIEWED" },
    });
  }

  return (
    <PublicShell>
      <section className="bg-[#0A192F] text-white py-10 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-xs font-bold uppercase tracking-widest text-sky-300">
            Via Codos Secure Electronic Execution
          </div>
          <h1 className="font-heading mt-1 text-2xl sm:text-3xl font-extrabold">
            Review &amp; Sign: {sigReq.documentTitle}
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Prepared for {sigReq.clientName}
            {sigReq.clientCompany ? ` (${sigReq.clientCompany})` : ""} · Dual-party PDF copy will be emailed upon signing.
          </p>
        </div>
      </section>

      <section className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SignaturePadClient
            initialRequest={{
              id: sigReq.id,
              token: sigReq.token,
              documentTitle: sigReq.documentTitle,
              documentVersion: sigReq.documentVersion,
              renderedHtml: sigReq.renderedHtml,
              clientName: sigReq.clientName,
              clientEmail: sigReq.clientEmail,
              clientCompany: sigReq.clientCompany,
              partyBName: sigReq.partyBName,
              partyBEmail: sigReq.partyBEmail,
              status: sigReq.status,
              signerFullName: sigReq.signerFullName,
              signedDateText: sigReq.signedDateText,
              verificationHash: sigReq.verificationHash,
              signedPdfPath: sigReq.signedPdfPath,
            }}
          />
        </div>
      </section>
    </PublicShell>
  );
}

