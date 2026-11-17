import React from "react";
import { CaseStudiesDirectory } from "@/components/CaseStudiesDirectory";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  return (
    <CaseStudiesDirectory
      crumbLabel="Portfolio"
      eyebrow="Portfolio & Case Studies"
      title="Our Featured Work"
      subtitle="Explore how Via Codos builds flagship vertical ERPs and AI automation platforms delivering measurable operational impact."
    />
  );
}
