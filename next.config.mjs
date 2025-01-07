/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // Remove this once you've fixed all type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    // Remove this once you've fixed all ESLint errors
    ignoreDuringBuilds: true,
  },
}

export default nextConfig;
