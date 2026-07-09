import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: "bottom-right"
  },
  turbopack: {
    ignoreIssue: [{
      path: "**/src/lib/database/**",
      description: "just ignore this"
    }]
  }
};

export default nextConfig;
