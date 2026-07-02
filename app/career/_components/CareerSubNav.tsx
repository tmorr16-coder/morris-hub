"use client";

import SubNav from "@/components/SubNav";

const TABS = [
  { href: "/career", label: "Overview" },
  { href: "/career/goals", label: "Goals" },
  { href: "/career/timeline", label: "Timeline" },
  { href: "/career/70", label: "70% Experiences" },
  { href: "/career/20", label: "20% Relationships" },
  { href: "/career/10", label: "10% Learning" },
  { href: "/career/profile", label: "Profile & Assessment" },
  { href: "/career/advisor", label: "Career Advisor" },
  { href: "/career/certifications", label: "Certifications" },
  { href: "/career/lsat", label: "LSAT Prep" },
  { href: "/career/settings", label: "⚙ Settings" },
];

export default function CareerSubNav() {
  return <SubNav tabs={TABS} />;
}
