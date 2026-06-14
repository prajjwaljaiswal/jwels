module.exports = {
  apps: [
    // ─── API (Express) ───────────────────────────────────────────────
    {
      name: 'vrindaonline-api',
      cwd: './apps/api',
      script: 'node',
      args: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },

    // ─── Customer Storefront (Next.js, port 3000) ─────────────────────
    {
      name: 'vrindaonline-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },

    // ─── Vendor Dashboard (Next.js, port 3001) ────────────────────────
    {
      name: 'vrindaonline-vendor',
      cwd: './apps/vendor',
      script: 'node_modules/.bin/next',
      args: 'start -p 3001',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },

    // ─── Admin Console (Next.js, port 3002) ───────────────────────────
    {
      name: 'vrindaonline-admin',
      cwd: './apps/admin',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },

    // ─── Storefront (Next.js, port 3003) ─────────────────────────────
    {
      name: 'vrindaonline-storefront',
      cwd: './apps/storefront',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
    },
  ],
};
