/** @type {import('next').NextConfig} */
module.exports = {
  transpilePackages: ['@jewel/ui', '@jewel/lib'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};
