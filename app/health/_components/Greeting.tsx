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
    <div
      suppressHydrationWarning
      style={{
        fontFamily: "var(--font-display)",
        fontSize: 34,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
      }}
    >
      <span suppressHydrationWarning>{salutation}</span>,<br />
      <span style={{ color: "var(--color-accent)" }}>{name ?? "there"}.</span>
    </div>
  );
}
