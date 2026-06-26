import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "morrisai.family",
    short_name: "Morris AI",
    description: "Personal & family productivity platform",
    start_url: "/home",
    display: "standalone",
    background_color: "#F7F4EE",
    theme_color: "#3B5C7F",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
