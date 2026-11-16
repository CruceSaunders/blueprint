import type { NextConfig } from "next";

// Static export: `next build` writes plain HTML/CSS/JS to out/, deployable to Vercel or any static host.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
