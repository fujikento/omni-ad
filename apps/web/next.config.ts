import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@omni-ad/shared', '@omni-ad/ui'],
  webpack: (config) => {
    // Workspace packages ship TypeScript source that uses NodeNext-style
    // ".js" extensions on relative imports (e.g. `./utils.js`). TypeScript's
    // "bundler" resolver handles that, but webpack needs an explicit hint to
    // map those to the corresponding .ts / .tsx files at build time.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
