import type { NextConfig } from 'next';

// Cache Components / partial prefetching left off: every page is client-rendered behind a localStorage token.
const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
