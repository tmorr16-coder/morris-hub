import { ImageResponse } from "next/og";
import { BRAND_GRADIENT, BRAND_MARK_PATH, BRAND_INK } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon — the M monogram. Full-bleed gradient (iOS masks corners).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: BRAND_GRADIENT,
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke={BRAND_INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d={BRAND_MARK_PATH} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
