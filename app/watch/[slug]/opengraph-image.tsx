import { ImageResponse } from 'next/og';
import { getTeamLogoUrl } from '@/lib/bzzoiro-api';
import { parseSlug } from '@/lib/server-matches';

export const alt = 'ZimKickOff Live Football Stream Preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
export const revalidate = 86400; // Cache dynamic OG image for 24 hours

async function safeGetLogo(name: string): Promise<string | undefined> {
  try {
    const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500));
    return await Promise.race([getTeamLogoUrl(name), timeoutPromise]);
  } catch {
    return undefined;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || '';

  // Parse slug to extract human readable team names
  const { isParseable, homeName: parsedHome, awayName: parsedAway } = parseSlug(slug);
  const homeName = isParseable && parsedHome ? parsedHome : 'Home Team';
  const awayName = isParseable && parsedAway ? parsedAway : 'Away Team';

  // Pre-fetch team logos safely with timeout protection
  const [homeLogo, awayLogo] = await Promise.all([
    safeGetLogo(homeName),
    safeGetLogo(awayName),
  ]);

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
          backgroundColor: '#000000', 
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(0, 151, 57, 0.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(0, 151, 57, 0.1) 0%, transparent 50%)',
          color: '#ffffff',
          fontFamily: '"Inter", sans-serif',
          position: 'relative',
        }}
      >
        {/* Decorative elements similar to reference */}
        <div style={{ position: 'absolute', top: '100px', left: '150px', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>+</div>
        <div style={{ position: 'absolute', bottom: '150px', right: '150px', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>+</div>
        <div style={{ position: 'absolute', top: '200px', right: '200px', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>×</div>
        <div style={{ position: 'absolute', bottom: '200px', left: '200px', color: 'rgba(255,255,255,0.2)', fontSize: '24px' }}>×</div>

        {/* Top Header Row */}
        <div style={{
          position: 'absolute',
          top: '50px',
          left: '60px',
          right: '60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* Brand Logo - ZimKickOff */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* Optional abstract icon or just text */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="28" height="32" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0L24 7V21L12 28L0 21V7L12 0Z" fill="#009739"/>
                <path d="M7 19L17 9M7 9L17 19" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '-1px',
              color: 'white'
            }}>
              ZimKickOff
            </span>
          </div>

          {/* Central Match Type Badge */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              color: '#ffffff',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}>
              WORLD CUP
            </div>
            {/* Decorative triangle outline under text like reference */}
            <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L20 18L40 0" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2"/>
            </svg>
          </div>
          
          <div style={{ width: '130px' }} /> {/* Spacer to balance right side */}
        </div>

        {/* Versing Bracket Display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            width: '100%',
            marginTop: '20px',
            gap: '80px',
          }}
        >
          {/* Home Team */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '320px',
          }}>
            <div style={{
              width: '280px',
              height: '280px',
              backgroundColor: 'white',
              borderRadius: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              marginBottom: '24px',
              padding: '40px',
            }}>
               {homeLogo ? (
                 <img 
                   src={homeLogo} 
                   alt={homeName}
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               ) : (
                 <span style={{ fontSize: '72px', color: '#cbd5e1', fontWeight: '900' }}>
                   {homeName.charAt(0).toUpperCase()}
                 </span>
               )}
            </div>
            <span style={{
              fontSize: '38px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-1px',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {homeName}
            </span>
          </div>

          {/* Away Team */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '320px',
          }}>
            <div style={{
              width: '280px',
              height: '280px',
              backgroundColor: 'white',
              borderRadius: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              marginBottom: '24px',
              padding: '40px',
            }}>
               {awayLogo ? (
                 <img 
                   src={awayLogo} 
                   alt={awayName}
                   style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                 />
               ) : (
                 <span style={{ fontSize: '72px', color: '#cbd5e1', fontWeight: '900' }}>
                   {awayName.charAt(0).toUpperCase()}
                 </span>
               )}
            </div>
            <span style={{
              fontSize: '38px',
              fontWeight: '800',
              color: '#ffffff',
              letterSpacing: '-1px',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {awayName}
            </span>
          </div>
        </div>

      </div>
    ),
    {
      ...size,
    }
  );
}
