import { Suspense } from "react";
import Link from "next/link";
import { LargeTitle, Icons } from "@/components/ios";
import NewCertClient from "./NewCertClient";

export const dynamic = "force-dynamic";

export default function NewCertificationPage() {
  return (
    <div className="ios-scroll">
      <Link
        href="/career/certifications"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }}
        className="ios-subhead"
      >
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> Certifications
      </Link>
      <LargeTitle title="Add Certification" />
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--ios-label-2)" }}>Loading…</div>}>
        <NewCertClient />
      </Suspense>
    </div>
  );
}
