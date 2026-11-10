import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "192.168.20.75:3000"],
};

export default nextConfig;
