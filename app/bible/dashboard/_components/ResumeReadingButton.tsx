"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getActiveReadingSession } from "@/lib/active-reading-session";
import { IconBadge, Icons } from "@/components/ios";

export default function ResumeReadingButton() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const active = getActiveReadingSession();
    setSession(active);
  }, []);

  if (!session) return null;

  return (
    <Link
      href={`/bible/read/${session.bookId}/${session.chapter}?v=${encodeURIComponent(session.bibleId)}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "var(--ios-orange)",
        color: "white",
        borderRadius: 12,
        textDecoration: "none",
        fontSize: 15,
        fontWeight: 600,
        marginTop: 8,
        marginBottom: 8,
      }}
      title="Resume your active Bible reading"
    >
      <Icons.BookIcon style={{ width: 18, height: 18 }} />
      <div style={{ flex: 1 }}>Resume reading {session.label}</div>
      <Icons.ChevronRight style={{ width: 16, height: 16, marginLeft: "auto" }} />
    </Link>
  );
}
