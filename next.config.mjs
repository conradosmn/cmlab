/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // manifold-3d (Laboratório) tem um ramo só para Node que importa estes
      // módulos; no navegador eles nunca rodam.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        fs: false,
        path: false,
        url: false,
      };
    }
    return config;
  },
};

export default nextConfig;
