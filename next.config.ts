import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "192.168.20.75:3000"],
  // Two dev servers on one folder (e.g. two editors each running `npm run dev`) overwrite each
  // other's build files and pages break on reload ("Cannot find module './897.js'").
  // A second server can use its own folder: NEXT_DIST_DIR=.next-3001 npm run dev -- -p 3001
  // Unset (Vercel, normal use) it stays ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
