import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#4338ca",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        sizes: "180x180",
        src: "/apple-icon",
        type: "image/png",
      },
    ],
    name: "next-push demo",
    orientation: "portrait",
    short_name: "next-push",
    start_url: "/",
    theme_color: "#4338ca",
  };
}
