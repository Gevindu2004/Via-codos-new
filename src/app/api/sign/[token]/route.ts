import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSignedAgreementPdf } from "@/lib/pdf";
import { dispatchEmail } from "@/lib/email";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sigReq = await prisma.signatureRequest.findUnique({
    where: { token },
  });
  if (!sigReq) {
    return NextResponse.json({ error: "Signing link not found." }, { status: 404 });
  }
  if (sigReq.status === "PENDING") {
    await prisma.signatureRequest.update({
      where: { id: sigReq.id },
      data: { status: "VIEWED" },
    });
  }
  return NextResponse.json({ signatureRequest: sigReq });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const sigReq = await prisma.signatureRequest.findUnique({ where: { token } });
    if (!sigReq) {
      return NextResponse.json({ error: "Invalid signing token." }, { status: 404 });
    }
    if (sigReq.status === "SIGNED") {
      return NextResponse.json({ error: "This agreement has already been signed." }, { status: 400 });
    }

    const body = await req.json();
    const {
      signatureMode,
      signatureDataUrl,
      signaturePosition,
      signerFullName,
      signerTitle,
      signedDateText,
      agreedToElectronic,
    } = body;

    if (!agreedToElectronic) {
      return NextResponse.json(
        { error: "You must check 'I agree to sign electronically' to execute this agreement." },
        { status: 400 }
      );
    }
    if (!signerFullName || !signatureDataUrl || !signedDateText) {
      return NextResponse.json(
        { error: "Full name, date, and placed signature are required." },
        { status: 400 }
      );
    }

    const signerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const pdfResult = await generateSignedAgreementPdf({
      requestId: sigReq.id,
      token: sigReq.token,
      documentTitle: sigReq.documentTitle,
      documentVersion: sigReq.documentVersion,
      renderedHtml: sigReq.renderedHtml,
      clientName: sigReq.clientName,
      clientEmail: sigReq.clientEmail,
      clientCompany: sigReq.clientCompany,
      partyBName: sigReq.partyBName,
      partyBEmail: sigReq.partyBEmail,
      signerFullName: String(signerFullName),
      signerTitle: signerTitle ? String(signerTitle) : null,
      signedDateText: String(signedDateText),
      signatureDataUrl: String(signatureDataUrl),
      signatureMode: String(signatureMode || "DRAW"),
      signaturePosition: signaturePosition || { xPct: 0.1, yPct: 0.2 },
      signerIp,
    });

    const updated = await prisma.signatureRequest.update({
      where: { id: sigReq.id },
      data: {
        status: "SIGNED",
        signatureMode: String(signatureMode || "DRAW"),
        signatureDataUrl: String(signatureDataUrl),
        signaturePositionJson: JSON.stringify(signaturePosition || { xPct: 0.1, yPct: 0.2 }),
        signerFullName: String(signerFullName),
        signerTitle: signerTitle ? String(signerTitle) : null,
        signedDateText: String(signedDateText),
        agreedToElectronic: true,
        signerIp,
        verificationHash: pdfResult.verificationHash,
        signedPdfPath: pdfResult.relativePath,
        signedAt: new Date(),
      },
    });

    // Email BOTH parties with the stamped PDF attached/linked
    const subject = `Executed Agreement: ${sigReq.documentTitle} (v${sigReq.documentVersion})`;
    const bodyText = `Dear ${sigReq.clientName} & ${sigReq.partyBName},\n\nThe agreement "${sigReq.documentTitle}" (v${sigReq.documentVersion}) has been electronically executed by ${signerFullName} on ${signedDateText}.\n\nVerification SHA-256: ${pdfResult.verificationHash}\nSigned PDF is attached and archived securely.\n\nRegards,\nVia Codos Legal & Operations`;

    await Promise.all([
      dispatchEmail({
        toEmail: sigReq.clientEmail,
        subject,
        bodyText,
        attachmentPath: pdfResult.absolutePath,
        attachmentName: `${sigReq.documentTitle.replace(/[^a-z0-9]+/gi, "-")}-SIGNED.pdf`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      }),
      dispatchEmail({
        toEmail: sigReq.partyBEmail,
        subject: `[Executed Copy] ${subject}`,
        bodyText,
        attachmentPath: pdfResult.absolutePath,
        attachmentName: `${sigReq.documentTitle.replace(/[^a-z0-9]+/gi, "-")}-SIGNED.pdf`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      }),
    ]);

    // If linked to a client hiring pipeline request, advance stage to CONTRACT (or HIRED + mark talent PLACED!)
    if (sigReq.pipelineRequestId) {
      const pipe = await prisma.profileRequest.findUnique({
        where: { id: sigReq.pipelineRequestId },
      });
      if (pipe) {
        await prisma.profileRequest.update({
          where: { id: pipe.id },
          data: { stage: "HIRED" },
        });
        await prisma.talentProfile.update({
          where: { id: pipe.talentId },
          data: { placementStatus: "PLACED" },
        });
      }
    }

    await recordAuditLog({
      actorEmail: sigReq.clientEmail,
      actorRole: "CLIENT_SIGNER",
      action: "SIGN",
      entityType: "SignatureRequest",
      entityId: sigReq.id,
      entityLabel: sigReq.documentTitle,
      summary: `Document electronically signed by ${signerFullName} (${sigReq.clientEmail}); stamped PDF stored and emailed to both parties.`,
      ipAddress: signerIp,
    });

    return NextResponse.json({
      signatureRequest: updated,
      pdfUrl: `/api/sign/${token}/pdf`,
      verificationHash: pdfResult.verificationHash,
    });
  } catch (err) {
    console.error("E-sign submit error:", err);
    return NextResponse.json({ error: "Failed to stamp and save signed PDF." }, { status: 500 });
  }
}

