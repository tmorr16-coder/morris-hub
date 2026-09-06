import { ImageResponse } from "next/og";
import { BRAND_GRADIENT, BRAND_MARK_PATH, BRAND_INK } from "@/lib/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Browser-tab favicon — the M monogram in a rounded gradient square.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: BRAND_GRADIENT,
          borderRadius: 15,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={BRAND_INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={BRAND_MARK_PATH} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
