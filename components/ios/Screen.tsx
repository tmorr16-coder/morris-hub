import { Children, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { ComposeIcon, ChevronLeft } from "./icons";
import { TabBar } from "./TabBar";

/**
 * Compact top nav bar for pushed detail screens — a back button (with the
 * previous screen's name) on the leading edge, optional centered title.
 */
export function NavBar({ back, title, trailing }: { back: { label: string; onBack: () => void }; title?: string; trailing?: ReactNode }) {
  return (
    <div className="ios-navbar">
      <button className="ios-back" onClick={back.onBack} aria-label={`Back to ${back.label}`}>
        <ChevronLeft aria-hidden style={{ width: 20, height: 20 }} />
        {back.label}
      </button>
      {title && <span className="ios-navbar-title ios-headline">{title}</span>}
      <span className="ios-navbar-trail">{trailing}</span>
    </div>
  );
}

/**
 * Root of an iOS-native screen. Sets the `data-ui="ios"` scope (activating the
 * design system from app/ios.css) and provides the scroll container. Force a
 * theme with `theme`; otherwise it follows the OS.
 */
export function IOSScreen({ children, theme }: { children: ReactNode; theme?: "light" | "dark" }) {
  // The tab bar is lifted out of the scrolling area.
  //
  // Most screens pass it as a child of IOSScreen, which put it inside <main>
  // — the element that now scrolls. A bar inside the thing that scrolls can
  // only be held still by position: fixed, and a fixed element inside a
  // scrolling container is exactly the case iOS gets wrong: it paints against
  // the scroller and travels with the content. That is the drifting bar.
  //
  // Rendered as a sibling of <main> instead, it is a plain flex item at the
  // bottom of a shell that never scrolls, so it cannot move at all — no fixed
  // positioning, and nothing for a browser to disagree about. The eight module
  // layouts already render it as a sibling and are unaffected.
  //
  // If the identity check ever fails to match, the bar simply stays where it
  // was and the screen behaves as it did before.
  const kids = Children.toArray(children);
  const bar = kids.find((c) => isValidElement(c) && c.type === TabBar);
  const rest = bar ? kids.filter((c) => c !== bar) : kids;

  return (
    <div data-ui="ios" data-theme={theme}>
      <main className="ios-scroll">{rest}</main>
      {bar}
    </div>
  );
}

/**
 * Large-title header (Today, etc.) with a subtitle line and optional trailing
 * accessory (avatar, compose button). Not sticky-collapsing yet — that lands
 * with the scroll behavior in a later pass.
 */
/** The morrisai.family wordmark — an "M" monogram badge + wordmark. Taps home. */
export function BrandMark({ style }: { style?: React.CSSProperties }) {
  return (
    <Link href="/home" aria-label="Home" style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", ...style }}>
      <span
        aria-hidden
        style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          background: "linear-gradient(140deg, #4A86C6 0%, #2F62A0 100%)",
          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.30), 0 1px 2px rgba(16,24,40,0.20)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19V6l8 8 8-8v13" />
        </svg>
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.006em", color: "var(--ios-label)" }}>
        morrisai<span style={{ color: "var(--ios-tint)", fontWeight: 600 }}>.family</span>
      </span>
    </Link>
  );
}

export function LargeTitle({
  title,
  subtitle,
  avatarInitial,
  onCompose,
  composeIcon,
  composeLabel = "Compose",
  trailing,
  brand = false,
}: {
  title: string;
  subtitle?: ReactNode;
  avatarInitial?: string;
  onCompose?: () => void;
  /** Custom icon for the compose affordance (defaults to a pencil). */
  composeIcon?: ReactNode;
  /** Accessible label for the compose affordance. */
  composeLabel?: string;
  trailing?: ReactNode;
  /** Show the morrisai.family wordmark above the title (key/hub screens). */
  brand?: boolean;
}) {
  return (
    <div className="ios-title-block" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {brand && <BrandMark style={{ marginBottom: 5 }} />}
        <h1 className="ios-large-title">{title}</h1>
        {subtitle != null && <div className="ios-subhead ios-title-sub">{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingTop: 6 }}>
        {onCompose && (
          <button onClick={onCompose} aria-label={composeLabel} title={composeLabel} style={{ color: "var(--ios-tint)", display: "flex" }}>
            {composeIcon ?? <ComposeIcon aria-hidden style={{ width: 24, height: 24 }} />}
          </button>
        )}
        {trailing}
        {avatarInitial && (
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600,
              textDecoration: "none", flexShrink: 0,
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(16,24,40,0.16)",
            }}
          >
            {avatarInitial}
          </Link>
        )}
      </div>
    </div>
  );
}
