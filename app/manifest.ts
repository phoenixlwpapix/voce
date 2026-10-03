import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voce — 个人词典",
    short_name: "Voce",
    description:
      "沉浸雅致的多语种生词本，支持英语、法语、西班牙语与日语。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#1c1c1a",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
