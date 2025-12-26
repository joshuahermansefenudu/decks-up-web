import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "decksupcard.com" }],
        destination: "https://www.decksupcard.com/:path*",
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
