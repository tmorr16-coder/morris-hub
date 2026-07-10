"use client";

export default function Greeting({ name }: { name: string | null }) {
  // Pin to Indianapolis time so the greeting is consistent across server
  // rendering, browser timezones, and devices with skewed system clocks.
  const userTz = "America/Indiana/Indianapolis";
  const h = parseInt(
    new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }),
    10
  );
  const salutation =
    h < 5  ? "Good evening" :
    h < 12 ? "Good morning" :
    h < 17 ? "Good afternoon" :
             "Good evening";

  return (
    <h1 suppressHydrationWarning className="ios-large-title" style={{ padding: "8px var(--ios-gutter) 6px" }}>
      <span suppressHydrationWarning>{salutation}</span>,{" "}
      <span style={{ color: "var(--ios-tint)" }}>{name ?? "there"}</span>
    </h1>
  );
}
