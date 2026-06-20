/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@jewel/ui', '@jewel/lib'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  experimental: {
    serverComponentsExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // isomorphic-dompurify (used by the richText block) pulls in jsdom, which reads a
      // CSS asset via fs at require time; webpack-bundling it for the server breaks that
      // path. Mark these external so they load from node_modules at runtime. This covers
      // BOTH server layers (RSC + client-component SSR) — serverComponentsExternalPackages
      // alone doesn't reach the client-SSR layer. Required now that the storefront layout
      // is a Server Component and block modules evaluate server-side.
      const existing = Array.isArray(config.externals)
        ? config.externals
        : [config.externals].filter(Boolean);
      config.externals = [...existing, 'isomorphic-dompurify', 'jsdom', 'canvas'];
    }
    return config;
  },
};
