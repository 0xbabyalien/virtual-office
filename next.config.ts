import type { NextConfig } from "next";
const isProd = process.env.NODE_ENV === "production";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: isProd ? "/virtual-office" : "",
  assetPrefix: isProd ? "/virtual-office/" : "",
};
export default nextConfig;
