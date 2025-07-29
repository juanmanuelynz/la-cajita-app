/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@tailwindcss/postcss'],
  },
  webpack: (config, { isServer }) => {
    // Configuración específica para Tailwind CSS v4
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};

export default nextConfig;