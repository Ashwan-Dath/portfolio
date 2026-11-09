/**
 * app/layout.tsx
 * The root layout: the <html> and <body> shared by every page, the fonts, the page metadata
 * (title, description, link previews), the X-ray provider, and the header and footer.
 * Server Component. Next.js wraps every page in it automatically.
 */
import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { ChatWidget } from '@/components/ChatWidget/ChatWidget';
import { SiteFooter } from '@/components/SiteFooter/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { site } from '@/content/site';
import { isDemoMode } from '@/lib/env';
import { XRAY_BOOT_SCRIPT } from '@/xray/constants';
import { XrayProvider } from '@/xray/XrayContext';
import './globals.css';

/**
 * Fonts are downloaded at build time and served from this site (next/font), so there is no request to
 * Google when a visitor loads the page and no layout jump when the font arrives.
 * Archivo is a variable font with a width axis: headings use it stretched wide, like drawing lettering.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

/** Monospace for labels, numbers and code names. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

/** What search engines and link previews (LinkedIn, Slack, WhatsApp) show for this site. */
export const metadata: Metadata = {
  metadataBase: new URL(site.siteUrl),
  title: `${site.name}, ${site.role}`,
  description: site.tagline,
  openGraph: {
    title: `${site.name}, ${site.role}`,
    description: site.tagline,
    url: site.siteUrl,
    siteName: site.name,
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

/** Browser UI colour (mobile address bar) matching the page in light and dark mode. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1526' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script below may add data-xray to <html> before React loads,
    // which is intended, so React shouldn't warn that the attribute "differs from the server".
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies a saved X-ray choice before the first paint, so it doesn't flash off and on. */}
        <script dangerouslySetInnerHTML={{ __html: XRAY_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <XrayProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter demo={isDemoMode()} />
          <ChatWidget />
        </XrayProvider>
      </body>
    </html>
  );
}
