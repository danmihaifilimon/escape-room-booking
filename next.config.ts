import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/basePath";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  experimental: {
    serverActions: {
      // The admin cancel action is a POST whose Origin header Next checks
      // against the Host it sees. Behind the filimondanmihai.ro/booking
      // reverse proxy the Host is the Vercel one while the browser's Origin
      // is the personal site — a mismatch Next would reject without this.
      allowedOrigins: ["filimondanmihai.ro", "www.filimondanmihai.ro"],
    },
  },
};

export default nextConfig;
