import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server actions default to a 1 MB body. The Health record import sends a
  // photographed lab report through one, and a phone photo is more than that
  // even after resizing; the child-document flow hit exactly this and hung.
  // 4 MB matches Vercel's request ceiling with room to spare.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  async redirects() {
    return [
      // health.morrisai.family → morrisai.family/health
      {
        source: "/:path*",
        has: [{ type: "host", value: "health.morrisai.family" }],
        destination: "https://morrisai.family/health/:path*",
        permanent: true,
      },
      // finance.morrisai.family → morrisai.family/finance
      {
        source: "/:path*",
        has: [{ type: "host", value: "finance.morrisai.family" }],
        destination: "https://morrisai.family/finance/:path*",
        permanent: true,
      },
      // bible.morrisai.family → morrisai.family/bible
      {
        source: "/:path*",
        has: [{ type: "host", value: "bible.morrisai.family" }],
        destination: "https://morrisai.family/bible/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
