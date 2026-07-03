import type { ReactNode } from "react";
import { ComposeIcon, ChevronLeft } from "./icons";

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
  return (
    <div data-ui="ios" data-theme={theme}>
      <div className="ios-scroll">{children}</div>
    </div>
  );
}

/**
 * Large-title header (Today, etc.) with a subtitle line and optional trailing
 * accessory (avatar, compose button). Not sticky-collapsing yet — that lands
 * with the scroll behavior in a later pass.
 */
/** The morrisai.family wordmark — a small brand eyebrow. */
export function BrandMark({ style }: { style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ios-tint)", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", color: "var(--ios-label-2)" }}>
        morrisai<span style={{ color: "var(--ios-tint)" }}>.family</span>
      </span>
    </span>
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
          <span
            aria-hidden
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600,
            }}
          >
            {avatarInitial}
          </span>
        )}
      </div>
    </div>
  );
}
