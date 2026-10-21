import type { NextConfig } from 'next';
const config: NextConfig = { transpilePackages: ['@sirocco/shared'], poweredByHeader: false, devIndicators: false };
export default config;
