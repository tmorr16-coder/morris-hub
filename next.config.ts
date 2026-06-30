import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
