import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signClientToken, CLIENT_COOKIE } from "@/lib/auth";
import { dispatchEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, companyName, companyWebsite, companyCountry, jobTitle, phone } =
      body;

    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { error: "Name, work email, password, and company name are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await prisma.clientUser.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const client = await prisma.clientUser.create({
      data: {
        name: String(name),
        email: normalizedEmail,
        passwordHash: hashPassword(String(password)),
        companyName: String(companyName),
        companyWebsite: companyWebsite ? String(companyWebsite) : null,
        companyCountry: companyCountry ? String(companyCountry) : null,
        jobTitle: jobTitle ? String(jobTitle) : null,
        phone: phone ? String(phone) : null,
        verificationStatus: "PENDING",
      },
    });

    await dispatchEmail({
      toEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
      subject: `New Client Verification Request: ${companyName}`,
      bodyText: `New client registered: ${name} (${normalizedEmail}) from ${companyName} (${companyWebsite || "no website"}). Review and verify in /admin/clients.`,
      relatedEntity: `ClientUser:${client.id}`,
    });

    const token = await signClientToken({
      clientId: client.id,
      email: client.email,
      name: client.name,
      companyName: client.companyName,
      verificationStatus: client.verificationStatus,
      kind: "client",
    });

    const res = NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        companyName: client.companyName,
        verificationStatus: client.verificationStatus,
      },
    });
    res.cookies.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    console.error("Client register error:", err);
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}

