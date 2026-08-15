import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "morrisai.family",
    short_name: "Morris AI",
    description: "Personal & family productivity platform",
    start_url: "/home",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#356FB0",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
