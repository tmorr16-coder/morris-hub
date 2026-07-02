import { Suspense } from "react";
import NewCertClient from "./NewCertClient";

export const dynamic = "force-dynamic";

export default function NewCertificationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--color-ink-3)" }}>Loading…</div>}>
      <NewCertClient />
    </Suspense>
  );
}
