/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
    ],
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
};

export default nextConfig;
