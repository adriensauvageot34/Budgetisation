import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/history-v2-publication": ["./private/*.json.gz"],
  },
};

export default nextConfig;
