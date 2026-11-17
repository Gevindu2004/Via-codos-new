import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dispatchEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`inquiry:${ip}`, 12, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many inquiry submissions. Please wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      company,
      phone,
      serviceLine,
      roleNeeded,
      domain,
      skillsText,
      headcount,
      engagementModel,
      timeline,
      timezoneOverlap,
      message,
      ndaRequired,
    } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, work email, and requirement details are required." },
        { status: 400 }
      );
    }

    const referenceCode = `VC-REQ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const inquiry = await prisma.staffingInquiry.create({
      data: {
        referenceCode,
        name: String(name),
        email: String(email),
        company: company ? String(company) : null,
        phone: phone ? String(phone) : null,
        serviceLine: String(serviceLine || "IT Outsourcing & Staff Augmentation"),
        roleNeeded: roleNeeded ? String(roleNeeded) : null,
        domain: domain ? String(domain) : null,
        skillsText: skillsText ? String(skillsText) : null,
        headcount: Number(headcount || 1),
        engagementModel: engagementModel ? String(engagementModel) : null,
        timeline: timeline ? String(timeline) : null,
        timezoneOverlap: timezoneOverlap ? String(timezoneOverlap) : null,
        message: String(message),
        ndaRequired: Boolean(ndaRequired ?? true),
      },
    });

    await dispatchEmail({
      toEmail: String(email),
      ccEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
      subject: `Via Codos Request Received [${referenceCode}]`,
      bodyText: `Hello ${name},\n\nThank you for submitting your staff augmentation / engineering inquiry (${referenceCode}).\n\nOur delivery leadership team has received your requirements (${roleNeeded || serviceLine}) and will contact you shortly with suitable vetted engineering or management resources${ndaRequired ? " under NDA" : ""}.\n\nRegards,\nVia Codos (PVT) LTD`,
      relatedEntity: `StaffingInquiry:${inquiry.id}`,
    });

    return NextResponse.json({ inquiry, referenceCode });
  } catch (err) {
    console.error("Inquiry error:", err);
    return NextResponse.json({ error: "Failed to submit inquiry." }, { status: 500 });
  }
}

