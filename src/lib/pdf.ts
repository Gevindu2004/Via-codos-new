import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function stripHtmlToBlocks(html: string): Array<{ text: string; isHeading: boolean }> {
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|blockquote)>/gi, "\n")
    .replace(/<(h1|h2|h3|h4)[^>]*>/gi, "\n###HEADING###")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");

  return normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("###HEADING###")) {
        return { text: line.replace("###HEADING###", "").trim(), isHeading: true };
      }
      return { text: line, isHeading: false };
    });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sanitizePdfText(text: string): string {
  // WinAnsi encoding in StandardFonts supports Latin-1 / basic punctuation; replace unsupported unicode cleanly
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, "--")
    .replace(/\u2013/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u2192/g, "->")
    .replace(/[^\x20-\xFF]/g, " ");
}

export interface GenerateSignedPdfInput {
  requestId: string;
  token: string;
  documentTitle: string;
  documentVersion: string;
  renderedHtml: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string | null;
  partyBName: string;
  partyBEmail: string;
  signerFullName: string;
  signerTitle?: string | null;
  signedDateText: string;
  signatureDataUrl: string;
  signatureMode: string;
  signaturePosition?: { xPct?: number; yPct?: number; widthPct?: number } | null;
  signerIp?: string | null;
}

export async function generateSignedAgreementPdf(input: GenerateSignedPdfInput): Promise<{
  relativePath: string;
  absolutePath: string;
  verificationHash: string;
}> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 50;
  const navy = rgb(0.04, 0.1, 0.19);
  const slate = rgb(0.28, 0.34, 0.42);
  const black = rgb(0.05, 0.08, 0.12);
  const borderGray = rgb(0.82, 0.86, 0.91);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 54;

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: pageHeight - 86,
    width: pageWidth,
    height: 86,
    color: navy,
  });
  page.drawText("VIA CODOS (PVT) LTD", {
    x: marginX,
    y: pageHeight - 36,
    size: 10,
    font: fontBold,
    color: rgb(0.75, 0.85, 0.98),
  });
  page.drawText(sanitizePdfText(input.documentTitle), {
    x: marginX,
    y: pageHeight - 58,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(
    sanitizePdfText(`Version ${input.documentVersion}  |  Electronic Execution Record`),
    {
      x: marginX,
      y: pageHeight - 74,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.8, 0.87, 0.95),
    }
  );

  y = pageHeight - 114;

  // Parties summary box
  page.drawRectangle({
    x: marginX,
    y: y - 48,
    width: pageWidth - marginX * 2,
    height: 54,
    borderColor: borderGray,
    borderWidth: 1,
    color: rgb(0.97, 0.98, 0.99),
  });
  page.drawText(
    sanitizePdfText(
      `Party A (Client): ${input.clientName}${input.clientCompany ? ` (${input.clientCompany})` : ""} <${input.clientEmail}>`
    ),
    { x: marginX + 12, y: y - 14, size: 9, font: fontBold, color: black }
  );
  page.drawText(
    sanitizePdfText(`Party B (Provider): ${input.partyBName} <${input.partyBEmail}>`),
    { x: marginX + 12, y: y - 30, size: 9, font: fontRegular, color: slate }
  );
  page.drawText(
    sanitizePdfText(`Document Reference: ${input.requestId}  |  Executed: ${input.signedDateText}`),
    { x: marginX + 12, y: y - 43, size: 8, font: fontRegular, color: slate }
  );

  y -= 72;

  // Render document body
  const blocks = stripHtmlToBlocks(input.renderedHtml);
  for (const block of blocks) {
    const wrapped = wrapText(sanitizePdfText(block.text), block.isHeading ? 72 : 90);
    if (block.isHeading) y -= 6;
    for (const line of wrapped) {
      if (y < 95) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - 56;
      }
      page.drawText(line, {
        x: marginX,
        y,
        size: block.isHeading ? 11 : 9.5,
        font: block.isHeading ? fontBold : fontRegular,
        color: block.isHeading ? navy : black,
      });
      y -= block.isHeading ? 16 : 13.5;
    }
    y -= 4;
  }

  // Ensure enough space for signature execution block (or start a fresh execution block)
  if (y < 230) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 60;
  } else {
    y -= 14;
  }

  // Signature execution box
  const boxTop = y;
  const boxHeight = 185;
  const boxWidth = pageWidth - marginX * 2;
  page.drawRectangle({
    x: marginX,
    y: boxTop - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: navy,
    borderWidth: 1.2,
    color: rgb(0.985, 0.99, 1),
  });

  page.drawText("ELECTRONIC SIGNATURE & EXECUTION CERTIFICATE", {
    x: marginX + 14,
    y: boxTop - 20,
    size: 10,
    font: fontBold,
    color: navy,
  });

  // Compute placed signature coordinates inside the execution canvas area
  const fieldX = marginX + 14;
  const fieldY = boxTop - 108;
  const fieldW = 240;
  const fieldH = 74;

  page.drawRectangle({
    x: fieldX,
    y: fieldY,
    width: fieldW,
    height: fieldH,
    borderColor: borderGray,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Stamp signature image into the placed field
  try {
    const base64Match = input.signatureDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
    if (base64Match) {
      const imgType = base64Match[1].toLowerCase();
      const imgBytes = Buffer.from(base64Match[2], "base64");
      const embeddedImg =
        imgType === "png" ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
      const dims = embeddedImg.scaleToFit(fieldW - 16, fieldH - 14);
      const xOffsetPct = Math.min(Math.max(input.signaturePosition?.xPct ?? 0.1, 0), 0.7);
      const yOffsetPct = Math.min(Math.max(input.signaturePosition?.yPct ?? 0.2, 0), 0.7);
      const drawX = fieldX + 6 + xOffsetPct * Math.max(fieldW - dims.width - 12, 0);
      const drawY = fieldY + 6 + (1 - yOffsetPct) * Math.max(fieldH - dims.height - 12, 0) * 0.5;
      page.drawImage(embeddedImg, {
        x: drawX,
        y: drawY,
        width: dims.width,
        height: dims.height,
      });
    }
  } catch (err) {
    console.error("Signature image embed fallback:", err);
    page.drawText(sanitizePdfText(input.signerFullName), {
      x: fieldX + 16,
      y: fieldY + 30,
      size: 16,
      font: fontBold,
      color: navy,
    });
  }

  const metaX = fieldX + fieldW + 20;
  page.drawText(sanitizePdfText(`Signed By: ${input.signerFullName}`), {
    x: metaX,
    y: boxTop - 46,
    size: 9.5,
    font: fontBold,
    color: black,
  });
  if (input.signerTitle) {
    page.drawText(sanitizePdfText(`Title/Role: ${input.signerTitle}`), {
      x: metaX,
      y: boxTop - 62,
      size: 8.5,
      font: fontRegular,
      color: slate,
    });
  }
  page.drawText(sanitizePdfText(`Date Signed: ${input.signedDateText}`), {
    x: metaX,
    y: boxTop - 78,
    size: 8.5,
    font: fontRegular,
    color: slate,
  });
  page.drawText(sanitizePdfText(`Method: ${input.signatureMode} Electronic Signature`), {
    x: metaX,
    y: boxTop - 94,
    size: 8.5,
    font: fontRegular,
    color: slate,
  });
  page.drawText(sanitizePdfText(`Signer IP: ${input.signerIp || "Recorded"}`), {
    x: metaX,
    y: boxTop - 110,
    size: 8.5,
    font: fontRegular,
    color: slate,
  });

  const verificationHash = crypto
    .createHash("sha256")
    .update(
      `${input.token}|${input.signerFullName}|${input.clientEmail}|${input.signedDateText}|${input.documentVersion}`
    )
    .digest("hex");

  page.drawText(
    "Consent: Signer checked 'I agree to sign electronically' and consented to legally binding electronic execution.",
    {
      x: marginX + 14,
      y: boxTop - 134,
      size: 8,
      font: fontRegular,
      color: slate,
    }
  );
  page.drawText(`Verification SHA-256: ${verificationHash}`, {
    x: marginX + 14,
    y: boxTop - 152,
    size: 7.5,
    font: fontBold,
    color: navy,
  });
  page.drawText("Via Codos (PVT) LTD · Galle, Ginthota, Sri Lanka · info@viacodos.com", {
    x: marginX + 14,
    y: boxTop - 170,
    size: 7.5,
    font: fontRegular,
    color: slate,
  });

  const pdfBytes = await pdfDoc.save();
  const dir = path.join(process.cwd(), "storage", "signed-pdfs");
  await fs.mkdir(dir, { recursive: true });
  const filename = `signed-${input.requestId}-${Date.now()}.pdf`;
  const absolutePath = path.join(dir, filename);
  await fs.writeFile(absolutePath, pdfBytes);

  return {
    relativePath: `storage/signed-pdfs/${filename}`,
    absolutePath,
    verificationHash,
  };
}

