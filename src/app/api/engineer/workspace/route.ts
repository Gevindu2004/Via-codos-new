import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEngineerSession } from "@/lib/auth";
import { safeJsonParse } from "@/lib/sanitize";
import {
  findEngineerAccountById,
  listEngineerTasks,
  listMessagesForTalent,
} from "@/lib/engineer-store";

export async function GET() {
  const session = await getEngineerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await findEngineerAccountById(session.engineerId);
  if (!account || account.status !== "ACTIVE") {
    return NextResponse.json({ error: "Engineer account disabled." }, { status: 401 });
  }

  const [talent, engagements, tasks, messages] = await Promise.all([
    prisma.talentProfile.findUnique({ where: { id: session.talentId } }),
    prisma.profileRequest.findMany({
      where: {
        talentId: session.talentId,
        stage: { notIn: ["REJECTED"] },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
            companyCountry: true,
            verificationStatus: true,
          },
        },
        interviews: { orderBy: { createdAt: "desc" } },
        meetings: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    listEngineerTasks(session.talentId),
    listMessagesForTalent(session.talentId),
  ]);

  if (!talent) {
    return NextResponse.json({ error: "Talent profile not found." }, { status: 404 });
  }

  return NextResponse.json({
    engineer: {
      id: account.id,
      profileCode: account.profileCode,
      email: account.email,
      name: account.name,
      roleTitle: talent.roleTitle,
      domainName: talent.domainName,
      availability: talent.availability,
      placementStatus: talent.placementStatus,
      skills: safeJsonParse<string[]>(talent.skillsJson, []),
    },
    engagements: engagements.map((e) => ({
      id: e.id,
      stage: e.stage,
      requestNotes: e.requestNotes,
      client: e.client,
      interviews: e.interviews.map((iv) => ({
        id: iv.id,
        token: iv.token,
        scheduledSlot: iv.scheduledSlot,
        timezone: iv.timezone,
        status: iv.status,
        questions: safeJsonParse<string[]>(iv.questionsJson, []),
        transcript: safeJsonParse<
          Array<{ question: string; answer: string; timestamp: string; aiEvaluation?: string }>
        >(iv.transcriptJson, []),
        aiSummary: iv.aiSummary,
        overallScore: iv.overallScore,
      })),
      meetings: e.meetings,
      updatedAt: e.updatedAt,
    })),
    tasks,
    messages,
  });
}

