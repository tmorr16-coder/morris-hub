import { NextResponse } from "next/server";

// The child's page has its own web-app manifest. The site-wide one starts at
// /home, and iOS opens a home-screen icon at the manifest's start_url, not at
// the page that was saved — so an icon saved from /kid opened the grown-ups'
// sign-in instead of the child's screen.
export function GET() {
  return NextResponse.json({
    name: "My Learning",
    short_name: "Learn",
    start_url: "/kid",
    scope: "/kid",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#2ACF5F",
    orientation: "any",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json" } });
}
