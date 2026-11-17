import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  SEED_CASE_STUDIES,
  SEED_INDUSTRIES,
  SEED_SAAS_PRODUCTS,
  SEED_SERVICES,
  SEED_TEAM,
  SEED_TESTIMONIALS,
} from "../../prisma/seed-data/corporate";
import {
  SEED_INSIGHTS,
  SEED_LEGAL_DOCS,
  SEED_LEGAL_TYPES,
} from "../../prisma/seed-data/insights-legal";
import {
  SAMPLE_DISPLAY_NAMES,
  SEED_TALENT_DOMAINS,
  SEED_TALENT_PROFILES,
} from "../../prisma/seed-data/talent";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  console.log("Seeding Via Codos Azure SQL database...");

  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(16).toString("hex");
  const editorPassword =
    process.env.SEED_EDITOR_PASSWORD || crypto.randomBytes(16).toString("hex");
  const clientPassword =
    process.env.SEED_CLIENT_PASSWORD || crypto.randomBytes(16).toString("hex");

  await prisma.adminUser.upsert({
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

  await prisma.clientUser.upsert({
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

  const settingsEntries: Array<[string, unknown]> = [
    [
      "brand",
      {
        companyName: "Via Codos (PVT) LTD",
        tagline: "We Take Care of Your IT. So You May Focus on Your Business.",
        email: "info@viacodos.com",
        phone: "+94 77 123 4567",
        address: "Galle, Ginthota, Sri Lanka",
        founded: "September 2024",
        codosConsoleUrl: "/codos-console",
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

  for (const [key, value] of settingsEntries) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, valueJson: JSON.stringify(value) },
    });
  }

  if ((await prisma.menuItem.count()) === 0) {
    const menus = [
      { location: "HEADER", label: "Home", href: "/", sortOrder: 1 },
      { location: "HEADER", label: "Services", href: "/services", sortOrder: 2 },
      { location: "HEADER", label: "SaaS Products", href: "/saas", sortOrder: 3 },
      { location: "HEADER", label: "Talent Bench", href: "/talent", sortOrder: 4 },
      { location: "HEADER", label: "Industries", href: "/industries", sortOrder: 5 },
      { location: "HEADER", label: "Portfolio", href: "/portfolio", sortOrder: 6 },
      { location: "HEADER", label: "Why Via Codos", href: "/why/why-us", sortOrder: 7 },
      { location: "HEADER", label: "Careers", href: "/company/careers", sortOrder: 8 },
      { location: "HEADER", label: "Legal", href: "/legal", sortOrder: 9 },
      { location: "HEADER", label: "Insights & Case Studies", href: "/insights", sortOrder: 10 },
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
    for (const item of menus) {
      await prisma.menuItem.create({ data: item });
    }
  }

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

  if ((await prisma.teamMember.count()) === 0) {
    for (let i = 0; i < SEED_TEAM.length; i++) {
      await prisma.teamMember.create({ data: { ...SEED_TEAM[i], sortOrder: i + 1 } });
    }
  }
  if ((await prisma.testimonial.count()) === 0) {
    for (let i = 0; i < SEED_TESTIMONIALS.length; i++) {
      await prisma.testimonial.create({ data: { ...SEED_TESTIMONIALS[i], sortOrder: i + 1 } });
    }
  }

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

  for (const td of SEED_TALENT_DOMAINS) {
    await prisma.talentDomain.upsert({
      where: { slug: td.slug },
      update: {},
      create: td,
    });
    await prisma.jobDomain.upsert({
      where: { slug: td.slug },
      update: {},
      create: { slug: td.slug, name: td.name, category: td.category, isAutoCreated: false },
    });
  }

  for (const tp of SEED_TALENT_PROFILES) {
    const displayName = tp.displayName ?? SAMPLE_DISPLAY_NAMES[tp.profileCode] ?? null;
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

  console.log("Azure SQL seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

