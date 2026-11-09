/**
 * next.config.ts
 * Project-wide Next.js settings. Next.js reads this file at build and dev start.
 */
import type { NextConfig } from 'next';

/**
 * HTTP security headers sent with every page and API response.
 * - nosniff: browsers must trust our Content-Type instead of guessing (stops some script-injection tricks).
 * - Referrer-Policy: other sites only see our domain, never full URLs, when a visitor follows a link out.
 * - X-Frame-Options DENY: nobody can embed this site in an <iframe> (prevents clickjacking).
 * - Permissions-Policy: the site never needs the camera, microphone or location, so it switches them off.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Strict Mode renders components twice in development to surface unsafe side effects early.
  reactStrictMode: true,
  // Don't advertise "X-Powered-By: Next.js": it tells attackers which stack to target.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
