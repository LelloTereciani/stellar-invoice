import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    useTypeScriptCli: false,
  },
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
