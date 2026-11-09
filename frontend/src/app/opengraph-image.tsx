/**
 * app/opengraph-image.tsx
 * Generates the preview image people see when the site's link is shared (LinkedIn, Slack, WhatsApp).
 * Next.js turns this JSX into a 1200×630 PNG at build time. The image renderer supports a subset of CSS
 * (flexbox layout, borders, colours), so every element with children uses display: flex.
 */
import { ImageResponse } from 'next/og';
import { site } from '@/content/site';

export const alt = `${site.name}, ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 48,
          background: '#17398e',
          color: '#eef3ff',
        }}
      >
        {/* Inner frame, like the border of a drawing sheet. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 48,
            border: '2px solid rgba(238, 243, 255, 0.6)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 4, textTransform: 'uppercase' }}>
            {site.role}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{site.name}</div>
            <div style={{ display: 'flex', fontSize: 38, marginTop: 24, color: '#b9c9f2' }}>
              Switch on X-ray and watch the stack run.
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
