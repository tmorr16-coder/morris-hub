import { Suspense } from "react";
import { LargeTitle } from "@/components/ios";
import NewCertClient from "./NewCertClient";

export const dynamic = "force-dynamic";

export default function NewCertificationPage() {
  return (
    <div className="ios-scroll">
      <LargeTitle title="Add Certification" />
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--ios-label-2)" }}>Loading…</div>}>
        <NewCertClient />
      </Suspense>
    </div>
  );
}
