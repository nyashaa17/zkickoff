import { ImageResponse } from 'next/og';
import { getTeamLogoUrl } from '@/lib/bzzoiro-api';

export const alt = 'ZimKickOff Match Preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
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
    // Standard fallbacks
  }

  // Pre-fetch team logos using our API lookup cache
  const homeLogo = await getTeamLogoUrl(homeName);
  const awayLogo = await getTeamLogoUrl(awayName);

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
          backgroundColor: '#0A0A0A', 
          backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(0, 151, 57, 0.22) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(0, 151, 57, 0.08) 0%, transparent 50%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative background grid and shapes */}
        <div style={{ position: 'absolute', top: '80px', left: '100px', color: 'rgba(255,255,255,0.15)', fontSize: '24px', fontWeight: 'bold' }}>+</div>
        <div style={{ position: 'absolute', bottom: '80px', right: '100px', color: 'rgba(255,255,255,0.15)', fontSize: '24px', fontWeight: 'bold' }}>+</div>
        <div style={{ position: 'absolute', top: '120px', right: '120px', color: 'rgba(0, 151, 57, 0.2)', fontSize: '24px', fontWeight: 'bold' }}>×</div>
        <div style={{ position: 'absolute', bottom: '120px', left: '120px', color: 'rgba(0, 151, 57, 0.2)', fontSize: '24px', fontWeight: 'bold' }}>×</div>
        
        {/* Top Header Row with BRAND & BRAND FLAG */}
        <div style={{
          position: 'absolute',
          top: '40px',
          left: '60px',
          right: '60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '1080px',
        }}>
          {/* Brand Logo - ZimKickOff */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0L24 7V21L12 28L0 21V7L12 0Z" fill="#009739"/>
                <path d="M7 19L17 9M7 9L17 19" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-1px',
              color: 'white',
              fontFamily: 'sans-serif'
            }}>
              ZimKickOff
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0, 151, 57, 0.15)',
            border: '1px solid rgba(0, 151, 57, 0.3)',
            borderRadius: '20px',
            padding: '6px 16px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00FF55' }}></div>
            <span style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#00FF55', fontFamily: 'sans-serif' }}>MATCH PREVIEW</span>
          </div>
        </div>

        {/* Dynamic centered Bold Title: Match Preview */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: '60px',
          marginBottom: '35px',
        }}>
          <span style={{
            fontSize: '60px',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '-2px',
            textAlign: 'center',
            lineHeight: '1.1',
            fontFamily: 'sans-serif'
          }}>
            Match Preview
          </span>
          <span style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#a3a3a3',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginTop: '6px',
            fontFamily: 'sans-serif'
          }}>
            Form, Head-to-Head & Predictions
          </span>
        </div>

        {/* Versing Bracket Display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1000px',
            gap: '40px',
          }}
        >
          {/* Home Team */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '24px 32px',
            width: '420px',
            height: '148px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              backgroundColor: 'white',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}>
               {homeLogo ? (
                 <img 
                   src={homeLogo} 
                   alt={homeName}
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               ) : (
                 <span style={{ fontSize: '36px', color: '#1e293b', fontWeight: '900', fontFamily: 'sans-serif' }}>
                   {homeName.charAt(0).toUpperCase()}
                 </span>
               )}
            </div>
            <span style={{
              fontSize: '30px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-1px',
              lineHeight: '1.2',
              fontFamily: 'sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxHeight: '100px',
            }}>
              {homeName}
            </span>
          </div>

          {/* VS Center Marker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#009739',
            border: '3px solid #00FF55',
            color: '#ffffff',
            fontSize: '22px',
            fontWeight: '900',
            fontStyle: 'italic',
            boxShadow: '0 0 20px rgba(0, 151, 57, 0.4)',
            flexShrink: 0,
            fontFamily: 'sans-serif'
          }}>
            VS
          </div>

          {/* Away Team */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '24px 32px',
            width: '420px',
            height: '148px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              backgroundColor: 'white',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              flexShrink: 0,
            }}>
               {awayLogo ? (
                 <img 
                   src={awayLogo} 
                   alt={awayName}
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               ) : (
                 <span style={{ fontSize: '36px', color: '#1e293b', fontWeight: '900', fontFamily: 'sans-serif' }}>
                   {awayName.charAt(0).toUpperCase()}
                 </span>
               )}
            </div>
            <span style={{
              fontSize: '30px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-1px',
              lineHeight: '1.2',
              fontFamily: 'sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxHeight: '100px',
            }}>
              {awayName}
            </span>
          </div>
        </div>

        {/* Footer info bar */}
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '60px',
          right: '60px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '1080px',
        }}>
          <span style={{
            fontSize: '15px',
            color: '#737373',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontWeight: '600',
            fontFamily: 'sans-serif'
          }}>
            zimkickoff.co.zw • No Signup Required • HD Streaming & Predictions
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
