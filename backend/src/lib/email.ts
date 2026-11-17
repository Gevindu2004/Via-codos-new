import nodemailer from "nodemailer";
import { prisma } from "./prisma";

interface SendEmailParams {
  toEmail: string;
  ccEmail?: string;
  subject: string;
  bodyText: string;
  attachmentPath?: string;
  attachmentName?: string;
  relatedEntity?: string;
}

export async function dispatchEmail(params: SendEmailParams) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || "587");
  const from = process.env.SMTP_FROM || "Via Codos <info@viacodos.com>";

  let status = "LOGGED_LOCAL";
  let errorMessage: string | null = null;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to: params.toEmail,
        cc: params.ccEmail,
        subject: params.subject,
        text: params.bodyText,
        attachments: params.attachmentPath
          ? [
              {
                filename: params.attachmentName || "signed-agreement.pdf",
                path: params.attachmentPath,
              },
            ]
          : undefined,
      });
      status = "SENT";
    } catch (err) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : "SMTP send error";
    }
  }

  return prisma.emailOutbox.create({
    data: {
      toEmail: params.toEmail,
      ccEmail: params.ccEmail ?? null,
      subject: params.subject,
      bodyText: params.bodyText,
      attachmentPath: params.attachmentPath ?? null,
      status,
      errorMessage,
      relatedEntity: params.relatedEntity ?? null,
    },
  });
}

