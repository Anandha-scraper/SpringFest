/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Hosting's Next.js adapter deploys the standalone server output.
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
