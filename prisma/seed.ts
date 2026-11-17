import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  SEED_SERVICES,
  SEED_INDUSTRIES,
  SEED_CASE_STUDIES,
  SEED_TEAM,
  SEED_TESTIMONIALS,
  SEED_SAAS_PRODUCTS,
} from "./seed-data/corporate";
import {
  SEED_INSIGHTS,
  SEED_LEGAL_TYPES,
  SEED_LEGAL_DOCS,
} from "./seed-data/insights-legal";
import {
  SEED_TALENT_DOMAINS,
  SEED_TALENT_PROFILES,
  SAMPLE_DISPLAY_NAMES,
} from "./seed-data/talent";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  console.log("Seeding Via Codos Enterprise Platform database...");

  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
  const editorPassword =
    process.env.SEED_EDITOR_PASSWORD || crypto.randomBytes(16).toString("hex");
  const clientPassword =
    process.env.SEED_CLIENT_PASSWORD || crypto.randomBytes(16).toString("hex");

  // 1. Admin Users
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@viacodos.com" },
    update: {},
    create: {
      email: "admin@viacodos.com",
      name: "Aadil Rizam (Super Admin)",
      passwordHash: hashPassword(adminPassword),
      role: "SUPER_ADMIN",
    },
  });

  await prisma.adminUser.upsert({
    where: { email: "editor@viacodos.com" },
    update: {},
    create: {
      email: "editor@viacodos.com",
      name: "Content & Legal Editor",
      passwordHash: hashPassword(editorPassword),
      role: "EDITOR",
    },
  });

  // 2. Demo Client Users
  const verifiedClient = await prisma.clientUser.upsert({
    where: { email: "client@enterprise-demo.com" },
    update: {},
    create: {
      name: "Fayazil Fahim",
      email: "client@enterprise-demo.com",
      passwordHash: hashPassword(clientPassword),
      companyName: "NorthStar Aerospace & Logistics Ltd.",
      companyWebsite: "https://northstar-demo.example.com",
      companyCountry: "Canada",
      jobTitle: "VP of Engineering & Operations",
      phone: "+1 514 555 0198",
      verificationStatus: "VERIFIED",
      verificationNotes: "Verified corporate registration and active NDA on file.",
      verifiedAt: new Date(),
    },
  });

  await prisma.clientUser.upsert({
    where: { email: "pending@acme-demo.com" },
    update: {},
    create: {
      name: "Jordan Sterling",
      email: "pending@acme-demo.com",
      passwordHash: hashPassword(clientPassword),
      companyName: "Acme Global Freight Inc.",
      companyWebsite: "https://acmefreight.example.com",
      companyCountry: "United States",
      jobTitle: "Director of Technology",
      verificationStatus: "PENDING",
    },
  });

  // 3. Site Settings
  const settingsData: Array<[string, unknown]> = [
    [
      "brand",
      {
        companyName: "Via Codos (PVT) LTD",
        shortName: "Via Codos",
        tagline: "We take care of your IT. So you may focus on your business, with peace of mind.",
        address: "Galle, Ginthota, Sri Lanka",
        phone: "+94 76 904 7552",
        whatsapp: "https://wa.me/94721980060",
        whatsappDisplay: "+94 721 980 060",
        email: "info@viacodos.com",
        codosConsoleUrl: "/codos-console",
        codosConsoleName: "Codos Console",
      },
    ],
    [
      "hero",
      {
        badge: "GLOBAL IT & SAAS ECOSYSTEM • 2025",
        eyebrow: "Enterprise Engineering · Staff Augmentation · Codos Console SaaS",
        headline: "Precision Engineering & Global Talent, Delivered.",
        subheadline:
          "Scale with vetted IT & management specialists, enterprise ERP systems, and the Codos Console SaaS suite — backed by NDA-first security and 40–70% cost efficiency.",
        primaryCtaLabel: "Request Talent or Consultation",
        primaryCtaHref: "/staff-augmentation/request",
        secondaryCtaLabel: "Explore Codos Console",
        secondaryCtaHref: "/codos-console",
        callouts: [
          { label: "Top 1% Vetted Bench", detail: "IT, Legacy & Management" },
          { label: "Codos Console SaaS", detail: "Skybeak · APIs · Call Colleague" },
          { label: "NDA-First & E-Sign", detail: "PDF Stamped Governance" },
        ],
      },
    ],
  ];

  for (const [key, value] of settingsData) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { valueJson: JSON.stringify(value) },
      create: { key, valueJson: JSON.stringify(value) },
    });
  }

  // 4. Menus (only seed if empty so admin edits persist)
  const menuCount = await prisma.menuItem.count();
  if (menuCount === 0) {
    const menus = [
      { location: "HEADER", label: "Services", href: "/services", sortOrder: 1 },
      { location: "HEADER", label: "SaaS Products", href: "/saas", sortOrder: 2 },
      { location: "HEADER", label: "Talent Bench", href: "/talent", sortOrder: 3 },
      { location: "HEADER", label: "Industries", href: "/industries", sortOrder: 4 },
      { location: "HEADER", label: "Portfolio", href: "/portfolio", sortOrder: 5 },
      { location: "HEADER", label: "Why Via Codos", href: "/why/why-us", sortOrder: 6 },
      { location: "HEADER", label: "Careers", href: "/company/careers", sortOrder: 7 },
      { location: "HEADER", label: "Legal", href: "/legal", sortOrder: 8 },
      { location: "HEADER", label: "Insights & Case Studies", href: "/insights", sortOrder: 9 },
      { location: "FOOTER_COMPANY", label: "About Us", href: "/company/about", sortOrder: 1 },
      { location: "FOOTER_COMPANY", label: "Our Team", href: "/company/team", sortOrder: 2 },
      { location: "FOOTER_COMPANY", label: "Careers & Screening", href: "/company/careers", sortOrder: 3 },
      { location: "FOOTER_COMPANY", label: "Staff Augmentation Request", href: "/staff-augmentation/request", sortOrder: 4 },
      { location: "FOOTER_COMPANY", label: "Contact Us", href: "/contact", sortOrder: 5 },
      { location: "FOOTER_RESOURCES", label: "Codos Console", href: "/codos-console", sortOrder: 1 },
      { location: "FOOTER_RESOURCES", label: "Skybeak", href: "/saas/skybeak", sortOrder: 2 },
      { location: "FOOTER_RESOURCES", label: "Thumbs Up APIs", href: "/saas/thumbs-up-apis", sortOrder: 3 },
      { location: "FOOTER_RESOURCES", label: "Call Colleague", href: "/saas/call-colleague", sortOrder: 4 },
      { location: "FOOTER_RESOURCES", label: "Client Portal", href: "/portal", sortOrder: 5 },
      { location: "FOOTER_LEGAL", label: "Privacy Policy", href: "/legal/privacy-policy", sortOrder: 1 },
      { location: "FOOTER_LEGAL", label: "Terms & Conditions", href: "/legal/terms-and-conditions", sortOrder: 2 },
      { location: "FOOTER_LEGAL", label: "NDA & Security", href: "/legal/nda-security", sortOrder: 3 },
      { location: "FOOTER_LEGAL", label: "SLA & DPA", href: "/legal/sla", sortOrder: 4 },
    ];
    await prisma.menuItem.createMany({ data: menus });
  }

  // 5. Categories
  const categories = [
    { name: "Corporate Pages", slug: "corporate-pages", scope: "PAGE", description: "Core company and solution pages", sortOrder: 1 },
    { name: "Platform & SaaS", slug: "platform-saas", scope: "PAGE", description: "Codos Console and cloud products", sortOrder: 2 },
    { name: "Governance & Trust", slug: "governance-trust", scope: "PAGE", description: "Security, compliance, and delivery methodology", sortOrder: 3 },
  ];
  for (const c of categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  const corpCat = await prisma.category.findUnique({ where: { slug: "corporate-pages" } });

  // 6. CMS Pages & Sections
  const aboutExists = await prisma.cmsPage.findUnique({ where: { slug: "about" } });
  if (!aboutExists) {
    await prisma.cmsPage.create({
      data: {
        slug: "about",
        title: "About Via Codos",
        subtitle: "We Take Care of Your IT. So You May Focus on Your Business.",
        metaTitle: "About Via Codos | Global IT Outsourcing & AI Solutions Company",
        metaDescription: "Via Codos is an international technology, staff augmentation, and SaaS company based in Sri Lanka serving 200+ global clients.",
        categoryId: corpCat?.id,
        template: "STANDARD",
        status: "PUBLISHED",
        isSystem: true,
        publishedAt: new Date(),
        updatedBy: "admin@viacodos.com",
        sections: {
          create: [
            {
              sectionKey: "story",
              type: "RICH_TEXT",
              title: "Our Story",
              subtitle: "Established September 2024 in Sri Lanka — Serving Clients Across Six Continents",
              bodyHtml:
                "<p>Founded to bridge global enterprises with Sri Lanka's exceptional engineering and management talent, Via Codos has delivered 500+ projects across custom software, vertical ERPs (BeltKit, Qalam, Realtor Grow), AI automation, and the Codos Console SaaS suite.</p><p>We operate with an IFS-inspired standard of governance: disciplined two-week sprint delivery, transparent fixed-rate augmentation, NDA-first confidentiality, and accountable senior leadership on every engagement.</p>",
              sortOrder: 1,
            },
            {
              sectionKey: "stats",
              type: "STATS_GRID",
              title: "Proof, Not Promises",
              dataJson: JSON.stringify([
                { value: "500+", label: "Projects Completed" },
                { value: "200+", label: "Clients Worldwide" },
                { value: "40–70%", label: "Cost Efficiency" },
                { value: "100+", label: "Vetted Engineers & Specialists" },
              ]),
              sortOrder: 2,
            },
          ],
        },
      },
    });
  }

  // 7. Services (All 15 existing services preserved!)
  for (const s of SEED_SERVICES) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        groupName: s.groupName,
        icon: s.icon,
        tagline: s.tagline,
        metaTitle: s.metaTitle,
        metaDescription: s.metaDescription,
        oneliner: s.oneliner,
        bodyJson: JSON.stringify(s.body),
        includedJson: JSON.stringify(s.included),
        disciplinesJson: s.disciplines ? JSON.stringify(s.disciplines) : null,
        levelsJson: s.levels ? JSON.stringify(s.levels) : null,
        statValue: s.statValue,
        statLabel: s.statLabel,
        videoUrl: s.videoUrl ?? null,
        posterUrl: s.posterUrl ?? null,
        sortOrder: s.sortOrder,
        status: "PUBLISHED",
      },
    });
  }

  // 8. Industries (All 12)
  for (let i = 0; i < SEED_INDUSTRIES.length; i++) {
    const ind = SEED_INDUSTRIES[i];
    await prisma.industry.upsert({
      where: { slug: ind.slug },
      update: {},
      create: {
        slug: ind.slug,
        name: ind.name,
        icon: ind.icon,
        metaTitle: ind.metaTitle,
        intro: ind.intro,
        challengesJson: JSON.stringify(ind.challenges),
        solutionsJson: JSON.stringify(ind.solutions),
        sortOrder: i + 1,
        status: "PUBLISHED",
      },
    });
  }

  // 9. Portfolio / Case Studies (All 4)
  for (let i = 0; i < SEED_CASE_STUDIES.length; i++) {
    const c = SEED_CASE_STUDIES[i];
    await prisma.caseStudy.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        sector: c.sector,
        imageUrl: c.imageUrl,
        videoUrl: c.videoUrl,
        posterUrl: c.posterUrl,
        metaTitle: c.metaTitle,
        metaDescription: c.metaDescription,
        headline: c.headline,
        clientDesc: c.clientDesc,
        challenge: c.challenge,
        solution: c.solution,
        implementationJson: JSON.stringify(c.implementation),
        resultsJson: JSON.stringify(c.results),
        quote: c.quote,
        sortOrder: i + 1,
        status: "PUBLISHED",
      },
    });
  }

  // 10. Insights (All 12)
  for (let i = 0; i < SEED_INSIGHTS.length; i++) {
    const a = SEED_INSIGHTS[i];
    await prisma.insightArticle.upsert({
      where: { slug: a.slug },
      update: {},
      create: {
        slug: a.slug,
        title: a.title,
        category: a.category,
        dateLabel: a.dateLabel,
        readTime: a.readTime,
        excerpt: a.excerpt,
        bodyHtml: a.paragraphs.map((p) => `<p>${p}</p>`).join("\n"),
        status: "PUBLISHED",
        sortOrder: i + 1,
      },
    });
  }

  // 11. Team & Testimonials
  if ((await prisma.teamMember.count()) === 0) {
    await prisma.teamMember.createMany({
      data: SEED_TEAM.map((t, idx) => ({ ...t, sortOrder: idx + 1 })),
    });
  }
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: SEED_TESTIMONIALS.map((t, idx) => ({ ...t, sortOrder: idx + 1 })),
    });
  }

  // 12. SaaS Products (Skybeak, Thumbs Up APIs, Call Colleague)
  for (let i = 0; i < SEED_SAAS_PRODUCTS.length; i++) {
    const p = SEED_SAAS_PRODUCTS[i];
    await prisma.saasProduct.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        badge: p.badge,
        summary: p.summary,
        descriptionHtml: p.descriptionHtml,
        featuresJson: JSON.stringify(p.features),
        metricsJson: JSON.stringify(p.metrics),
        pricingTiersJson: JSON.stringify(p.pricingTiers),
        heroImage: p.heroImage,
        consolePath: p.consolePath,
        sortOrder: i + 1,
        status: "PUBLISHED",
      },
    });
  }

  // 13. Legal Document Types & Documents
  for (const lt of SEED_LEGAL_TYPES) {
    await prisma.legalDocumentType.upsert({
      where: { slug: lt.slug },
      update: {},
      create: lt,
    });
  }

  for (const ld of SEED_LEGAL_DOCS) {
    const docType = await prisma.legalDocumentType.findUnique({ where: { slug: ld.typeSlug } });
    if (!docType) continue;
    await prisma.legalDocument.upsert({
      where: { slug: ld.slug },
      update: {},
      create: {
        typeId: docType.id,
        slug: ld.slug,
        title: ld.title,
        version: ld.version,
        effectiveDate: new Date("2026-07-01T00:00:00Z"),
        summary: ld.summary,
        contentHtml: ld.contentHtml,
        status: "PUBLISHED",
        isPublic: ld.isPublic,
        isTemplate: ld.isTemplate,
        updatedBy: "admin@viacodos.com",
      },
    });
  }

  // 14. Talent Domains & 40 Anonymized Profiles (20 IT + 20 Management)
  for (let i = 0; i < SEED_TALENT_DOMAINS.length; i++) {
    const td = SEED_TALENT_DOMAINS[i];
    await prisma.talentDomain.upsert({
      where: { slug: td.slug },
      update: {},
      create: { ...td, sortOrder: i + 1 },
    });
  }

  for (const tp of SEED_TALENT_PROFILES) {
    const displayName = tp.displayName || SAMPLE_DISPLAY_NAMES[tp.profileCode] || null;
    await prisma.talentProfile.upsert({
      where: { profileCode: tp.profileCode },
      update: { displayName },
      create: {
        profileCode: tp.profileCode,
        displayName,
        category: tp.category,
        domainSlug: tp.domainSlug,
        domainName: tp.domainName,
        roleTitle: tp.roleTitle,
        summary: tp.summary,
        skillsJson: JSON.stringify(tp.skills),
        yearsExperience: tp.yearsExperience,
        projectsJson: JSON.stringify(tp.projects),
        industriesJson: JSON.stringify(tp.industries),
        availability: tp.availability,
        hourlyRateUsd: tp.hourlyRateUsd,
        monthlyRateUsd: tp.monthlyRateUsd,
        visibilityFlag: tp.visibilityFlag,
        placementStatus: "AVAILABLE",
        status: "PUBLISHED",
      },
    });
  }

  // Backfill displayName for any REAL converted profiles linked to JobApplication
  const realWithoutName = await prisma.talentProfile.findMany({
    where: { internalCandidateId: { not: null }, displayName: null },
  });
  for (const rp of realWithoutName) {
    const app = await prisma.jobApplication.findUnique({
      where: { id: rp.internalCandidateId! },
    });
    if (app) {
      await prisma.talentProfile.update({
        where: { id: rp.id },
        data: { displayName: app.applicantName },
      });
    }
  }

  // 15. Job Domains, Job Postings & Sample Screening Applications
  const jobDomains = [
    { slug: "software-engineering", name: "Software Engineering", category: "IT" },
    { slug: "devops-cloud", name: "DevOps & Cloud", category: "IT" },
    { slug: "ai-ml", name: "AI & Machine Learning", category: "IT" },
    { slug: "cobol-mainframe", name: "Mainframe, COBOL & PL/I", category: "IT" },
    { slug: "accounting-finance", name: "Accounting & Finance", category: "MANAGEMENT" },
    { slug: "project-management", name: "Project & Program Management", category: "MANAGEMENT" },
  ];
  for (const jd of jobDomains) {
    await prisma.jobDomain.upsert({ where: { slug: jd.slug }, update: {}, create: jd });
  }

  if ((await prisma.jobPosting.count()) === 0) {
    const jobs = [
      {
        title: "Senior Full-Stack Engineer (Next.js / Node.js)",
        domainSlug: "software-engineering",
        domainName: "Software Engineering",
        employmentType: "Full-time",
        location: "Remote",
        experienceRequired: "5+ years experience",
        skills: ["TypeScript", "Next.js", "PostgreSQL", "AWS"],
        responsibilities: [
          "Lead architecture decisions for global client web & SaaS modules",
          "Mentor mid-level engineers inside dedicated delivery pods",
          "Own automated test coverage and code review standards",
        ],
      },
      {
        title: "DevOps & Kubernetes Platform Engineer",
        domainSlug: "devops-cloud",
        domainName: "DevOps & Cloud",
        employmentType: "Full-time",
        location: "Remote",
        experienceRequired: "3+ years experience",
        skills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD"],
        responsibilities: [
          "Design and maintain declarative Terraform & CI/CD pipelines",
          "Manage multi-region Kubernetes reliability and FinOps spend",
          "Implement observability, alerting, and incident playbooks",
        ],
      },
      {
        title: "Conversational AI / ML Engineer",
        domainSlug: "ai-ml",
        domainName: "AI & Machine Learning",
        employmentType: "Full-time",
        location: "Remote",
        experienceRequired: "2+ years experience",
        skills: ["Python", "PyTorch", "LLMs", "RAG", "WebRTC"],
        responsibilities: [
          "Build and fine-tune Call Colleague voice and automation agents",
          "Design deterministic escalation and safety guardrails",
          "Collaborate with enterprise clients on CRM & calendar workflows",
        ],
      },
      {
        title: "COBOL / Mainframe Modernization Specialist",
        domainSlug: "cobol-mainframe",
        domainName: "Mainframe, COBOL & PL/I",
        employmentType: "Full-time / Contract",
        location: "Remote",
        experienceRequired: "8+ years experience",
        skills: ["COBOL", "PL/I", "CICS", "JCL", "DB2"],
        responsibilities: [
          "Maintain and optimize core banking and insurance batch workloads",
          "Expose legacy CICS/DB2 modules to modern REST API gateways",
          "Document migration blueprints for zero-downtime transitions",
        ],
      },
      {
        title: "Chartered Management Accountant (Remote)",
        domainSlug: "accounting-finance",
        domainName: "Accounting & Finance",
        employmentType: "Full-time",
        location: "Remote",
        experienceRequired: "5+ years experience",
        skills: ["IFRS", "Xero", "NetSuite", "FP&A"],
        responsibilities: [
          "Own month-end close, reconciliations, and board financial packs",
          "Support international client entities across UK, US, and APAC",
        ],
      },
    ];
    for (const j of jobs) {
      const dom = await prisma.jobDomain.findUnique({ where: { slug: j.domainSlug } });
      await prisma.jobPosting.create({
        data: {
          title: j.title,
          domainId: dom?.id,
          domainSlug: j.domainSlug,
          domainName: j.domainName,
          employmentType: j.employmentType,
          location: j.location,
          experienceRequired: j.experienceRequired,
          skillsJson: JSON.stringify(j.skills),
          responsibilitiesJson: JSON.stringify(j.responsibilities),
          status: "PUBLISHED",
        },
      });
    }
  }

  // Sample Screening Queue Applications (ready to convert to REAL profiles!)
  if ((await prisma.jobApplication.count()) === 0) {
    await prisma.jobApplication.createMany({
      data: [
        {
          applicantName: "Kasun Wijesekara",
          applicantEmail: "kasun.w.applicant@example.com",
          applicantPhone: "+94 77 555 1020",
          domainName: "Software Engineering",
          domainSlug: "software-engineering",
          skillsJson: JSON.stringify(["TypeScript", "React", "Go", "Kubernetes", "PostgreSQL"]),
          yearsExperience: 7,
          expectedMonthlyRateUsd: 5200,
          summary:
            "7 years building high-throughput logistics & payment microservices for EU fintechs. Passed initial technical benchmark.",
          consentToProfile: true,
          screeningStatus: "APPROVED",
          screeningNotes: "Strong system design assessment. Ready to convert into live anonymized profile.",
        },
        {
          applicantName: "Nadeesha Perera",
          applicantEmail: "nadeesha.p.applicant@example.com",
          applicantPhone: "+94 71 555 2040",
          domainName: "Accounting & Finance",
          domainSlug: "accounting-finance",
          skillsJson: JSON.stringify(["CIMA", "IFRS", "NetSuite", "Power BI", "Audit Prep"]),
          yearsExperience: 9,
          expectedMonthlyRateUsd: 4800,
          summary:
            "CIMA-qualified controller with 9 years leading multi-currency ERP consolidations for SaaS and logistics firms.",
          consentToProfile: true,
          screeningStatus: "NEW",
        },
      ],
    });
  }

  // 16. Sample Client Pipeline Request (for immediate exploration of /portal and /admin/pipeline)
  if ((await prisma.profileRequest.count()) === 0) {
    const sampleTalent = await prisma.talentProfile.findUnique({ where: { profileCode: "VC-IT-101" } });
    if (sampleTalent) {
      await prisma.profileRequest.create({
        data: {
          clientId: verifiedClient.id,
          talentId: sampleTalent.id,
          stage: "APPROVED",
          requestNotes: "Need a Principal Full-Stack Architect for our Q3 logistics platform modernization.",
          adminApprovalNotes: "Client verified. Approved full anonymized engineering dossier release.",
          approvedAt: new Date(),
          approvedBy: admin.email,
          releasedDossierJson: JSON.stringify({
            profileCode: sampleTalent.profileCode,
            architectureStrengths: ["Event-driven Node.js/PostgreSQL", "Next.js multi-tenant SaaS", "Zero-downtime migrations"],
            timezoneOverlap: "5+ hours overlap with EST / GMT",
            vettingScores: { systemDesign: "94/100", liveCoding: "92/100", communication: "96/100" },
          }),
        },
      });
    }
  }

  // 17. Initial Audit Log
  if ((await prisma.auditLog.count()) === 0) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        actorRole: admin.role,
        action: "SEED_INIT",
        entityType: "SiteSetting",
        entityId: "platform",
        entityLabel: "Via Codos Platform v2.0",
        summary: "Initialized Via Codos corporate CMS, 15 services, 12 industries, 3 SaaS products, 40 anonymized talent profiles, and legal/e-sign engine.",
      },
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

