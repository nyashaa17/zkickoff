import type { ReactElement } from 'react';

/**
 * Shared stadium-style OG image layout for match pages.
 * Renders a floodlit night-stadium atmosphere using pure CSS gradients/shapes
 * (no external photo assets — Satori/resvg can't composite photographic textures).
 *
 * Used by both /preview/[slug] and /watch/[slug] opengraph-image routes.
 */

interface OgLayoutProps {
  homeName: string;
  awayName: string;
  homeLogo: string | undefined;
  awayLogo: string | undefined;
  /** Chip text shown at top center, e.g. "MATCH PREVIEW" or "WATCH LIVE" */
  chipLabel: string;
  /** Optional competition/league name shown above the chip */
  leagueName?: string;
}

/**
 * Truncate team name to fit within badge layout.
 * Keeps first N characters + ellipsis if too long.
 */
function truncateName(name: string, maxLen = 18): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1).trimEnd() + '…';
}

/**
 * Renders a circular team badge with logo or initial-letter fallback.
 */
function TeamBadge({ name, logo }: { name: string; logo: string | undefined }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '340px',
        gap: '0px',
      }}
    >
      {/* Circular badge */}
      <div
        style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '4px solid #009739',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0, 151, 57, 0.25), 0 4px 16px rgba(0,0,0,0.3)',
          padding: '24px',
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt={name}
            width="120"
            height="120"
            style={{ width: '120px', height: '120px', objectFit: 'contain' }}
          />
        ) : (
          <span
            style={{
              fontSize: '64px',
              color: '#1e293b',
              fontWeight: '900',
              fontFamily: 'sans-serif',
            }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {/* Team name below badge */}
      <span
        style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#ffffff',
          letterSpacing: '-0.5px',
          textAlign: 'center',
          lineHeight: '1.2',
          fontFamily: 'sans-serif',
          marginTop: '16px',
          maxWidth: '320px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {truncateName(name)}
      </span>
    </div>
  );
}

export function StadiumOgLayout({
  homeName,
  awayName,
  homeLogo,
  awayLogo,
  chipLabel,
  leagueName,
}: OgLayoutProps): ReactElement {
  const displayLeague = leagueName || chipLabel;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        /* Night sky: deep navy to black, with green pitch horizon in lower third */
        backgroundColor: '#050A14',
        backgroundImage: [
          /* Main sky gradient */
          'linear-gradient(180deg, #0A1628 0%, #050A14 55%, #0B2810 78%, #0A200E 100%)',
          /* Floodlight glow — top left */
          'radial-gradient(circle at 10% 5%, rgba(200, 220, 255, 0.12) 0%, transparent 40%)',
          /* Floodlight glow — top right */
          'radial-gradient(circle at 90% 5%, rgba(200, 220, 255, 0.12) 0%, transparent 40%)',
          /* Subtle center spotlight spill */
          'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.04) 0%, transparent 50%)',
        ].join(', '),
        color: '#ffffff',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Floodlight beam — left (diagonal glow) */}
      <div
        style={{
          position: 'absolute',
          top: '0px',
          left: '40px',
          width: '200px',
          height: '300px',
          background:
            'linear-gradient(160deg, rgba(200, 220, 255, 0.08) 0%, transparent 100%)',
          display: 'flex',
        }}
      />
      {/* Floodlight beam — right */}
      <div
        style={{
          position: 'absolute',
          top: '0px',
          right: '40px',
          width: '200px',
          height: '300px',
          background:
            'linear-gradient(200deg, rgba(200, 220, 255, 0.08) 0%, transparent 100%)',
          display: 'flex',
        }}
      />

      {/* Pitch horizon line — subtle green glow across the bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '100px',
          left: '0',
          right: '0',
          height: '2px',
          background:
            'linear-gradient(90deg, transparent 5%, rgba(0, 151, 57, 0.2) 30%, rgba(0, 151, 57, 0.3) 50%, rgba(0, 151, 57, 0.2) 70%, transparent 95%)',
          display: 'flex',
        }}
      />

      {/* Top center: league badge / competition pill */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0, 151, 57, 0.15)',
            border: '1px solid rgba(0, 151, 57, 0.35)',
            borderRadius: '24px',
            padding: '8px 24px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#00CC44',
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: '14px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#00CC44',
              fontFamily: 'sans-serif',
            }}
          >
            {displayLeague}
          </span>
        </div>
      </div>

      {/* Main content: badges + VS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          marginTop: '20px',
          gap: '0px',
        }}
      >
        {/* Home Team Badge */}
        <TeamBadge name={homeName} logo={homeLogo} />

        {/* VS marker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#009739',
            border: '3px solid #00CC44',
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: '900',
            fontStyle: 'italic',
            boxShadow: '0 0 24px rgba(0, 151, 57, 0.5), 0 0 48px rgba(0, 151, 57, 0.2)',
            flexShrink: 0,
            fontFamily: 'sans-serif',
            marginLeft: '24px',
            marginRight: '24px',
          }}
        >
          VS
        </div>

        {/* Away Team Badge */}
        <TeamBadge name={awayName} logo={awayLogo} />
      </div>

      {/* Footer: branded pill bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(10, 20, 30, 0.85)',
            border: '1px solid rgba(0, 151, 57, 0.3)',
            borderRadius: '28px',
            padding: '10px 32px',
          }}
        >
          {/* Brand accent bar */}
          <div
            style={{
              width: '6px',
              height: '22px',
              borderRadius: '3px',
              backgroundColor: '#009739',
              display: 'flex',
            }}
          />
          <span
            style={{
              fontSize: '16px',
              fontWeight: '700',
              color: 'rgba(255, 255, 255, 0.7)',
              letterSpacing: '1.5px',
              fontFamily: 'sans-serif',
            }}
          >
            zimkickoff.co.zw
          </span>
        </div>
      </div>
    </div>
  );
}
