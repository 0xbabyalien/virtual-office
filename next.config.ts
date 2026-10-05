import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/virtual-office",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
