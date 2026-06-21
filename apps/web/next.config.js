/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  async redirects() {
    // The marketing site is now vendor-only. Old consumer/auth URLs redirect so
    // bookmarks and inbound links don't 404. Login/Register go to the seller flow.
    return [
      { source: '/login', destination: '/sell/login', permanent: false },
      { source: '/register', destination: '/sell/register', permanent: false },
      { source: '/products', destination: '/', permanent: false },
      { source: '/products/:path*', destination: '/', permanent: false },
      { source: '/cart', destination: '/', permanent: false },
      { source: '/checkout', destination: '/', permanent: false },
      { source: '/account', destination: '/sell/login', permanent: false },
      { source: '/account/:path*', destination: '/sell/login', permanent: false },
      { source: '/orders', destination: '/sell/login', permanent: false },
      { source: '/orders/:path*', destination: '/sell/login', permanent: false },
      { source: '/collection/:slug', destination: '/', permanent: false },
      { source: '/c/:slug', destination: '/', permanent: false },
    ];
  },
};
