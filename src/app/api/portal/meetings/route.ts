import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { dispatchEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pipelineRequestId, scheduledSlot, timezone, notes } = await req.json();
  if (!pipelineRequestId || !scheduledSlot) {
    return NextResponse.json({ error: "Pipeline request and time slot are required." }, { status: 400 });
  }

  const pipe = await prisma.profileRequest.findUnique({
    where: { id: String(pipelineRequestId) },
    include: { talent: true },
  });
  if (!pipe || pipe.clientId !== session.clientId) {
    return NextResponse.json({ error: "Pipeline request not found." }, { status: 404 });
  }

  const meetingRoomCode = crypto.randomBytes(4).toString("hex");
  const meeting = await prisma.managementMeeting.create({
    data: {
      pipelineRequestId: pipe.id,
      scheduledSlot: new Date(scheduledSlot),
      timezone: String(timezone || "UTC"),
      meetingLink: `https://meet.viacodos.com/3way-${meetingRoomCode}`,
      attendeesJson: JSON.stringify([
        `${session.name} (Client - ${session.companyName})`,
        "Via Codos Delivery Management Lead",
        `Candidate ${pipe.talent.profileCode}`,
      ]),
      notes: notes ? String(notes) : "",
      status: "SCHEDULED",
    },
  });

  if (["APPROVED", "INTERVIEW"].includes(pipe.stage)) {
    await prisma.profileRequest.update({
      where: { id: pipe.id },
      data: { stage: "MEETING" },
    });
  }

  await dispatchEmail({
    toEmail: session.email,
    ccEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
    subject: `3-Way Management Meeting Confirmed [${pipe.talent.profileCode}]`,
    bodyText: `Three-way meeting via Via Codos Management booked for ${scheduledSlot} (${timezone || "UTC"}).\nMeeting Room: ${meeting.meetingLink}\nNotes: ${notes || "None"}`,
    relatedEntity: `ManagementMeeting:${meeting.id}`,
  });

  return NextResponse.json({ meeting });
}

export async function PATCH(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId, notes } = await req.json();
  const meeting = await prisma.managementMeeting.findUnique({
    where: { id: String(meetingId) },
    include: { pipelineRequest: true },
  });
  if (!meeting || meeting.pipelineRequest.clientId !== session.clientId) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const updated = await prisma.managementMeeting.update({
    where: { id: meeting.id },
    data: { notes: String(notes || "") },
  });
  return NextResponse.json({ meeting: updated });
}

