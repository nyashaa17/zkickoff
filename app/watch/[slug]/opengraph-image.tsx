import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'ZimKickOff Live Football Stream Preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || '';

  // Parse slug to extract human readable team names
  let homeName = 'Home Team';
  let awayName = 'Away Team';
  try {
    const parts = slug.split('-');
    const teamsPart = parts.slice(0, parts.length - 1).join('-');
    const teams = teamsPart.split('-vs-');
    if (teams[0]) {
      homeName = teams[0].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    if (teams[1]) {
      awayName = teams[1].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  } catch (e) {
    // standard fallbacks
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          backgroundImage: 'radial-gradient(circle at top right, rgba(0, 151, 57, 0.08) 0%, transparent 45%)',
          color: '#171717',
          fontFamily: 'sans-serif',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* Outer Brand Frame */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '42px',
            right: '42px',
            height: '4px',
            backgroundColor: '#009739', // ZimKickOff brand green
            borderRadius: '2px',
          }}
        />

        {/* Content Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            zIndex: 10,
          }}
        >
          {/* Tag Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
            <span
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '900',
                padding: '6px 14px',
                borderRadius: '8px',
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              • LIVE STREAM IN HD
            </span>
            <span
              style={{
                backgroundColor: '#f0fdf4',
                color: '#009739',
                fontSize: '14px',
                fontWeight: '900',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 151, 57, 0.2)',
                letterSpacing: '0.5px',
              }}
            >
              ZIMKICKOFF MATCHDAY
            </span>
          </div>

          {/* Versing Bracket Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              margin: '20px 0',
            }}
          >
            {/* Home Team Name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'right',
                width: '420px',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: '900',
                  color: '#171717',
                  letterSpacing: '-1.5px',
                  lineHeight: '1.1',
                }}
              >
                {homeName}
              </span>
              <span style={{ fontSize: '13px', color: '#009739', marginTop: '6px', fontWeight: 'bold', letterSpacing: '1px' }}>
                HOME SQUAD
              </span>
            </div>

            {/* Versus Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f4f4f5',
                border: '2px solid #e4e4e7',
                borderRadius: '50%',
                width: '90px',
                height: '90px',
                margin: '0 40px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: '900',
                  color: '#d97706', // ZimKickOff custom gold/yellow
                  letterSpacing: '-0.5px',
                }}
              >
                VS
              </span>
            </div>

            {/* Away Team Name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'left',
                width: '420px',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '44px',
                  fontWeight: '900',
                  color: '#171717',
                  letterSpacing: '-1.5px',
                  lineHeight: '1.1',
                }}
              >
                {awayName}
              </span>
              <span style={{ fontSize: '13px', color: '#71717a', marginTop: '6px', fontWeight: 'bold', letterSpacing: '1px' }}>
                AWAY SQUAD
              </span>
            </div>
          </div>

          {/* Bottom metadata instructions */}
          <p
            style={{
              fontSize: '18px',
              color: '#52525b',
              marginTop: '36px',
              maxWidth: '700px',
              textAlign: 'center',
              lineHeight: '1.5',
              fontWeight: '500',
            }}
          >
            Watch free live soccer stream. Free HD quality broadcast feed. No registration or credit cards required. Watch instantly.
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
