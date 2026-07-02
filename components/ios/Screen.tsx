import type { ReactNode } from "react";
import { ComposeIcon } from "./icons";

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
export function LargeTitle({
  title,
  subtitle,
  avatarInitial,
  onCompose,
  trailing,
}: {
  title: string;
  subtitle?: ReactNode;
  avatarInitial?: string;
  onCompose?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="ios-title-block" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1 className="ios-large-title">{title}</h1>
        {subtitle != null && <div className="ios-subhead ios-title-sub">{subtitle}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, paddingTop: 6 }}>
        {onCompose && (
          <button onClick={onCompose} aria-label="Compose" style={{ color: "var(--ios-tint)", display: "flex" }}>
            <ComposeIcon aria-hidden style={{ width: 24, height: 24 }} />
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
