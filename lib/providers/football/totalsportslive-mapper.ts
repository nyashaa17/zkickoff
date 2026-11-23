import 'server-only';
import {
  AllowedPlayerStatGroup,
  FootballProviderError,
  NormalizedCompetitionDetails,
  NormalizedCompetitionSummary,
  NormalizedFixturesResult,
  NormalizedLineupPlayer,
  NormalizedMatch,
  NormalizedMatchForm,
  NormalizedMatchIncident,
  NormalizedMatchInfo,
  NormalizedMatchLineups,
  NormalizedMatchStatistics,
  NormalizedMatchStatus,
  NormalizedPlayerCareerEntry,
  NormalizedPlayerProfile,
  NormalizedPlayerTournamentEntry,
  NormalizedReferee,
  NormalizedScore,
  NormalizedSquadPlayer,
  NormalizedStandingsResult,
  NormalizedStandingsRow,
  NormalizedStandingsTable,
  NormalizedTeamDetails,
  NormalizedTeamLineup,
  NormalizedTeamMatchStatLine,
  NormalizedTeamPlayerStatEntry,
  NormalizedTeamPlayerStats,
  NormalizedTeamSquad,
  NormalizedTeamSummary,
} from './types';
import {
  isPlainObject,
  optionalFiniteNumber,
  optionalInt,
  optionalNonEmptyString,
  optionalNonNegativeInt,
  requireNonEmptyString,
} from './validation';

const NUMERIC_ID_REGEX = /^\d{1,12}$/;
const ESD_REGEX = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;
const LIVE_MINUTE_REGEX = /^(\d{1,3})(?:\+\d+)?'?$/;

function optionalNumericId(value: unknown): string | null {
  const str = optionalNonEmptyString(value);
  if (!str || !NUMERIC_ID_REGEX.test(str)) return null;
  return str;
}

function slugifySegment(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'team';
}

/**
 * Parses TotalSportsLive Esd ("YYYYMMDDHHMMSS") into ISO-8601 UTC string.
 * Returns null if missing or not a valid calendar date/time.
 */
export function parseEsdToIso(esd: unknown): { iso: string | null; raw: string | null } {
  const raw = optionalNonEmptyString(esd);
  if (!raw) return { iso: null, raw: null };

  const match = ESD_REGEX.exec(raw);
  if (!match) return { iso: null, raw: null };

  const yyyy = Number(match[1]);
  const mm = Number(match[2]);
  const dd = Number(match[3]);
  const hh = Number(match[4]);
  const mi = Number(match[5]);
  const ss = Number(match[6]);

  if (hh > 23 || mi > 59 || ss > 59) return { iso: null, raw: null };

  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
  if (
    isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() !== mm - 1 ||
    dt.getUTCDate() !== dd
  ) {
    return { iso: null, raw: null };
  }

  return { iso: dt.toISOString(), raw };
}

/**
 * Parses an ISO or YYYY-MM-DD date string strictly; returns null if unparseable.
 */
function parseOptionalDateIso(value: unknown): string | null {
  const str = optionalNonEmptyString(value);
  if (!str) return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeMatchStatus(
  rawEps: unknown,
  kickoffIso: string | null,
  referenceNowMs = Date.now()
): { status: NormalizedMatchStatus; rawStatusCode: string | null; minute: number | null } {
  const code = optionalNonEmptyString(rawEps);
  if (!code) {
    if (kickoffIso) {
      return {
        status: isSameUtcDay(kickoffIso, referenceNowMs) ? 'TODAY' : 'UPCOMING',
        rawStatusCode: null,
        minute: null,
      };
    }
    return { status: 'UNKNOWN', rawStatusCode: null, minute: null };
  }

  const upper = code.toUpperCase();

  if (
    upper === 'FT' ||
    upper === 'AET' ||
    upper === 'AP' ||
    upper === 'ENDED' ||
    upper === 'FINISHED'
  ) {
    return { status: 'FINISHED', rawStatusCode: code, minute: null };
  }

  if (upper === 'POSTP.' || upper === 'POSTP' || upper === 'PST' || upper === 'DELAYED') {
    return { status: 'POSTPONED', rawStatusCode: code, minute: null };
  }

  if (
    upper === 'CANC.' ||
    upper === 'CANC' ||
    upper === 'CAN' ||
    upper === 'ABAND.' ||
    upper === 'ABD' ||
    upper === 'AWARDED'
  ) {
    return { status: 'CANCELLED', rawStatusCode: code, minute: null };
  }

  const minMatch = LIVE_MINUTE_REGEX.exec(code);
  if (minMatch) {
    return { status: 'LIVE', rawStatusCode: code, minute: Number(minMatch[1]) };
  }

  if (
    upper === 'HT' ||
    upper === 'LIVE' ||
    upper === '1H' ||
    upper === '2H' ||
    upper === 'ET' ||
    upper === 'PEN' ||
    upper === 'INT' ||
    upper === 'BT'
  ) {
    return { status: 'LIVE', rawStatusCode: code, minute: null };
  }

  if (upper === 'NS' || upper === 'NOT STARTED' || upper === 'TBD') {
    if (kickoffIso) {
      return {
        status: isSameUtcDay(kickoffIso, referenceNowMs) ? 'TODAY' : 'UPCOMING',
        rawStatusCode: code,
        minute: null,
      };
    }
    return { status: 'UPCOMING', rawStatusCode: code, minute: null };
  }

  return { status: 'UNKNOWN', rawStatusCode: code, minute: null };
}

function isSameUtcDay(iso: string, referenceNowMs: number): boolean {
  const dt = new Date(iso);
  const now = new Date(referenceNowMs);
  return (
    dt.getUTCFullYear() === now.getUTCFullYear() &&
    dt.getUTCMonth() === now.getUTCMonth() &&
    dt.getUTCDate() === now.getUTCDate()
  );
}

function mapTeamSummary(rawTeamArray: unknown): NormalizedTeamSummary | null {
  const first = Array.isArray(rawTeamArray) ? rawTeamArray[0] : rawTeamArray;
  if (!isPlainObject(first)) return null;
  const name = optionalNonEmptyString(first.Nm ?? first.name);
  if (!name) return null;

  return {
    id: optionalNumericId(first.ID ?? first.id),
    name,
    shortCode: optionalNonEmptyString(first.Abr ?? first.abr),
    badgePath: optionalNonEmptyString(first.Img ?? first.img ?? first.badgeUrl),
    primaryColor: optionalNonEmptyString(first.Fc ?? first.firstColor),
    secondaryColor: optionalNonEmptyString(first.Sc ?? first.secondColor),
  };
}

function mapCompetitionSummary(
  stage: Record<string, unknown>,
  fallbackComp?: Partial<NormalizedCompetitionSummary>
): NormalizedCompetitionSummary {
  const name =
    optionalNonEmptyString(stage.CompN ?? stage.Snm ?? stage.competitionName) ??
    fallbackComp?.name ??
    'Unknown Competition';

  return {
    compId: optionalNumericId(stage.CompId ?? stage.competitionId) ?? fallbackComp?.compId ?? null,
    stageId: optionalNumericId(stage.Sid ?? stage.stageId) ?? fallbackComp?.stageId ?? null,
    name,
    country: optionalNonEmptyString(stage.Cnm ?? stage.country) ?? fallbackComp?.country ?? null,
    slug: optionalNonEmptyString(stage.Scd ?? stage.CompUrlName) ?? fallbackComp?.slug ?? null,
    badgePath: optionalNonEmptyString(stage.badgeUrl) ?? fallbackComp?.badgePath ?? null,
    accentColor: optionalNonEmptyString(stage.firstColor) ?? fallbackComp?.accentColor ?? null,
  };
}

function extractScore(
  status: NormalizedMatchStatus,
  homeRaw: unknown,
  awayRaw: unknown
): NormalizedScore | null {
  // Strict rule: never emit numeric scores for not-started, postponed, cancelled, or unknown matches
  if (status !== 'LIVE' && status !== 'FINISHED') {
    return null;
  }
  const home = optionalNonNegativeInt(homeRaw);
  const away = optionalNonNegativeInt(awayRaw);
  if (home === null || away === null) return null;
  return { home, away };
}

export function mapRawEventToMatch(
  rawEvent: unknown,
  competition: NormalizedCompetitionSummary,
  referenceNowMs = Date.now()
): NormalizedMatch | null {
  if (!isPlainObject(rawEvent)) return null;

  const id = optionalNumericId(rawEvent.Eid ?? rawEvent.id);
  if (!id) return null;

  const homeTeam = mapTeamSummary(rawEvent.T1);
  const awayTeam = mapTeamSummary(rawEvent.T2);
  if (!homeTeam || !awayTeam) return null;

  const { iso: kickoffIso, raw: rawEsd } = parseEsdToIso(rawEvent.Esd);
  const { status, rawStatusCode, minute: epsMinute } = normalizeMatchStatus(
    rawEvent.Eps,
    kickoffIso,
    referenceNowMs
  );

  // Only accept Ela minute when match is LIVE
  const elaMinute = status === 'LIVE' ? optionalNonNegativeInt(rawEvent.Ela) : null;
  const minute = epsMinute ?? elaMinute;

  const score = extractScore(status, rawEvent.Tr1, rawEvent.Tr2);
  const halfTimeScore = extractScore(status, rawEvent.Trh1, rawEvent.Trh2);

  let venueName = optionalNonEmptyString(rawEvent.Vnm);
  if (!venueName && isPlainObject(rawEvent.Venue)) {
    venueName = optionalNonEmptyString(rawEvent.Venue.Vnm ?? rawEvent.Venue.name);
  }

  return {
    id,
    slug: `${slugifySegment(homeTeam.name)}-vs-${slugifySegment(awayTeam.name)}-${id}`,
    status,
    rawStatusCode,
    minute,
    kickoffIso,
    rawEsd,
    homeTeam,
    awayTeam,
    score,
    halfTimeScore,
    competition,
    venueName,
  };
}

// -----------------------------------------------------------------------------
// Endpoint Mappers (14 Verified Endpoints)
// -----------------------------------------------------------------------------

export function mapLivescoreDateResponse(
  raw: Record<string, unknown>,
  date: string,
  referenceNowMs = Date.now()
): NormalizedFixturesResult {
  if (!Array.isArray(raw.Stages)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Livescore response missing required "Stages" array.',
      { statusCode: 502, isTransient: false }
    );
  }

  const matches: NormalizedMatch[] = [];
  for (const stage of raw.Stages) {
    if (!isPlainObject(stage)) continue;
    const comp = mapCompetitionSummary(stage);
    const events = Array.isArray(stage.Events) ? stage.Events : [];
    for (const ev of events) {
      const mapped = mapRawEventToMatch(ev, comp, referenceNowMs);
      if (mapped) matches.push(mapped);
    }
  }

  return { date, matches };
}

export function mapMatchScoreboard(
  raw: Record<string, unknown>,
  referenceNowMs = Date.now()
): NormalizedMatch {
  const stageObj = isPlainObject(raw.Stg) ? raw.Stg : {};
  const comp = mapCompetitionSummary(stageObj);
  const mapped = mapRawEventToMatch(raw, comp, referenceNowMs);
  if (!mapped) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match scoreboard response missing valid Eid or team summaries.',
      { statusCode: 502, isTransient: false }
    );
  }
  return mapped;
}

export function mapMatchInfo(raw: Record<string, unknown>, requestedEventId: string): NormalizedMatchInfo {
  const hasKnownKey =
    raw.Eid !== undefined ||
    raw.Esd !== undefined ||
    raw.Vnm !== undefined ||
    raw.Vcy !== undefined ||
    raw.Refs !== undefined;
  if (!hasKnownKey) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match info response missing recognized fields (Eid/Esd/Vnm/Vcy/Refs).',
      { statusCode: 502, isTransient: false }
    );
  }

  const eventId = optionalNumericId(raw.Eid) ?? requestedEventId;
  const { iso: kickoffIso } = parseEsdToIso(raw.Esd);

  const referees: NormalizedReferee[] = [];
  if (Array.isArray(raw.Refs)) {
    for (const ref of raw.Refs) {
      if (!isPlainObject(ref)) continue;
      const name = optionalNonEmptyString(ref.Nm ?? ref.name);
      if (!name) continue;
      referees.push({
        name,
        country: optionalNonEmptyString(ref.Cn ?? ref.country),
        imageFile: optionalNonEmptyString(ref.imageUrl),
      });
    }
  }

  const isNeutralVenue =
    typeof raw.Vneut === 'boolean'
      ? raw.Vneut
      : raw.Vneut === 1
        ? true
        : raw.Vneut === 0
          ? false
          : null;

  return {
    eventId,
    kickoffIso,
    venueName: optionalNonEmptyString(raw.Vnm),
    city: optionalNonEmptyString(raw.Vcy),
    country: optionalNonEmptyString(raw.VCnm),
    attendance: optionalNonNegativeInt(raw.Vsp),
    isNeutralVenue,
    referees,
  };
}

export function mapMatchIncidents(raw: Record<string, unknown>): NormalizedMatchIncident[] {
  if (raw.Incs === undefined && raw.Eid === undefined) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match incidents response missing required "Incs" or "Eid" field.',
      { statusCode: 502, isTransient: false }
    );
  }
  const incs = raw.Incs;
  if (incs === undefined || incs === null) return [];
  if (!isPlainObject(incs)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match incidents response "Incs" field must be an object.',
      { statusCode: 502, isTransient: false }
    );
  }

  const result: NormalizedMatchIncident[] = [];
  for (const [period, items] of Object.entries(incs)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!isPlainObject(item)) continue;
      const teamNumRaw = optionalNonNegativeInt(item.Nm);
      const teamNumber: 1 | 2 | null = teamNumRaw === 1 ? 1 : teamNumRaw === 2 ? 2 : null;

      const first = optionalNonEmptyString(item.Fn);
      const last = optionalNonEmptyString(item.Ln);
      const fullName =
        optionalNonEmptyString(item.Pn) ??
        ([first, last].filter(Boolean).join(' ') || null);

      result.push({
        period,
        minute: optionalNonNegativeInt(item.Min),
        teamNumber,
        incidentTypeCode: optionalNonNegativeInt(item.IT),
        playerId: optionalNumericId(item.Aid),
        playerName: fullName,
        playerSlug: optionalNonEmptyString(item.Pnt),
        shirtNumber: optionalNonNegativeInt(item.Pnum),
      });
    }
  }

  return result;
}

export function mapMatchStatistics(
  raw: Record<string, unknown>,
  requestedEventId: string
): NormalizedMatchStatistics {
  if (raw.Stat === undefined && raw.Eid === undefined) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match statistics response missing required "Stat" or "Eid" field.',
      { statusCode: 502, isTransient: false }
    );
  }
  if (raw.Stat !== undefined && raw.Stat !== null && !Array.isArray(raw.Stat)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match statistics response "Stat" field must be an array.',
      { statusCode: 502, isTransient: false }
    );
  }
  const eventId = optionalNumericId(raw.Eid) ?? requestedEventId;
  const statList = raw.Stat;
  if (!Array.isArray(statList) || statList.length === 0) {
    return { eventId, available: false, teams: [] };
  }

  const teams: NormalizedTeamMatchStatLine[] = [];
  for (const entry of statList) {
    if (!isPlainObject(entry)) continue;
    const tnb = optionalNonNegativeInt(entry.Tnb);
    if (tnb !== 1 && tnb !== 2) continue;
    teams.push({
      teamNumber: tnb,
      possessionPct: optionalFiniteNumber(entry.Pss),
      shotsOnTarget: optionalNonNegativeInt(entry.Shon),
      shotsOffTarget: optionalNonNegativeInt(entry.Shof),
      shotsBlocked: optionalNonNegativeInt(entry.Shbl),
      corners: optionalNonNegativeInt(entry.Cos),
      fouls: optionalNonNegativeInt(entry.Fls),
      offsides: optionalNonNegativeInt(entry.Ofs),
      yellowCards: optionalNonNegativeInt(entry.Ycs),
      redCards: optionalNonNegativeInt(entry.Rcs),
      goalkeeperSaves: optionalNonNegativeInt(entry.Gks),
      expectedGoals: optionalFiniteNumber(entry.Xg),
    });
  }

  return {
    eventId,
    available: teams.length > 0,
    teams,
  };
}

export function mapMatchLineups(
  raw: Record<string, unknown>,
  requestedEventId: string
): NormalizedMatchLineups {
  if (raw.Lu === undefined && raw.Eid === undefined) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match lineups response missing required "Lu" or "Eid" field.',
      { statusCode: 502, isTransient: false }
    );
  }
  if (raw.Lu !== undefined && raw.Lu !== null && !Array.isArray(raw.Lu)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match lineups response "Lu" field must be an array.',
      { statusCode: 502, isTransient: false }
    );
  }
  const eventId = optionalNumericId(raw.Eid) ?? requestedEventId;
  const luList = raw.Lu;
  if (!Array.isArray(luList) || luList.length === 0) {
    return { eventId, available: false, teams: [] };
  }

  const teams: NormalizedTeamLineup[] = [];
  for (const teamBlock of luList) {
    if (!isPlainObject(teamBlock)) continue;
    const tnb = optionalNonNegativeInt(teamBlock.Tnb);
    if (tnb !== 1 && tnb !== 2) continue;

    const starters: NormalizedLineupPlayer[] = [];
    const rawPlayers = Array.isArray(teamBlock.Ps) ? teamBlock.Ps : [];
    for (const p of rawPlayers) {
      if (!isPlainObject(p)) continue;
      const aid = optionalNumericId(p.Aid);
      if (!aid) continue;

      const firstName = optionalNonEmptyString(p.Fn);
      const lastName = optionalNonEmptyString(p.Ln);
      const fullName =
        optionalNonEmptyString(p.Pnm) ??
        ([firstName, lastName].filter(Boolean).join(' ') || optionalNonEmptyString(p.Snm));
      if (!fullName) continue;

      const ratingObj = isPlainObject(p.Rating) ? p.Rating : null;

      starters.push({
        aid,
        firstName,
        lastName,
        fullName,
        slug: optionalNonEmptyString(p.Pnt),
        position: optionalNonEmptyString(p.Pon),
        shirtNumber: optionalNonNegativeInt(p.Snu),
        formationSlot: optionalNonEmptyString(p.Fp),
        rating: ratingObj ? optionalFiniteNumber(ratingObj.Rt) : null,
        ratingNote: ratingObj ? optionalNonEmptyString(ratingObj.Dsc) : null,
        imageFile: optionalNonEmptyString(p.imageUrl ?? p.ImageUrl),
      });
    }

    teams.push({ teamNumber: tnb, starters });
  }

  return {
    eventId,
    available: teams.some((t) => t.starters.length > 0),
    teams,
  };
}

export function mapMatchForm(
  raw: Record<string, unknown>,
  requestedEventId: string,
  referenceNowMs = Date.now()
): NormalizedMatchForm {
  if (raw.Eid === undefined && !Array.isArray(raw.T1) && !Array.isArray(raw.T2)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Match form response missing required "Eid", "T1", or "T2" field.',
      { statusCode: 502, isTransient: false }
    );
  }
  const eventId = optionalNumericId(raw.Eid) ?? requestedEventId;

  const extractFormMatches = (teamFormArr: unknown): NormalizedMatch[] => {
    if (!Array.isArray(teamFormArr)) return [];
    const results: NormalizedMatch[] = [];
    for (const block of teamFormArr) {
      if (!isPlainObject(block)) continue;
      const events = Array.isArray(block.EL) ? block.EL : [];
      for (const ev of events) {
        if (!isPlainObject(ev)) continue;
        const stageObj = isPlainObject(ev.Stg) ? ev.Stg : {};
        const comp = mapCompetitionSummary(stageObj);
        const mapped = mapRawEventToMatch(ev, comp, referenceNowMs);
        if (mapped) results.push(mapped);
      }
    }
    return results;
  };

  return {
    eventId,
    homeRecentMatches: extractFormMatches(raw.T1),
    awayRecentMatches: extractFormMatches(raw.T2),
  };
}

export function mapCompetitionDetails(
  raw: Record<string, unknown>,
  requestedCompId: string,
  referenceNowMs = Date.now()
): NormalizedCompetitionDetails {
  const compId = optionalNumericId(raw.CompId) ?? requestedCompId;
  const name = requireNonEmptyString(raw.CompN ?? raw.Snm, 'CompN');
  const country = optionalNonEmptyString(raw.Cnm);
  const urlSlug = optionalNonEmptyString(raw.CompUrlName ?? raw.CompD);
  const badgePath = optionalNonEmptyString(raw.badgeUrl);
  const accentColor = optionalNonEmptyString(raw.firstColor);

  const stages: NormalizedCompetitionDetails['stages'] = [];
  const rawStages = Array.isArray(raw.Stages) ? raw.Stages : [];
  for (const stage of rawStages) {
    if (!isPlainObject(stage)) continue;
    const stageId = optionalNumericId(stage.Sid);
    const stageName = optionalNonEmptyString(stage.Snm) ?? name;
    const compSummary = mapCompetitionSummary(stage, {
      compId,
      stageId,
      name,
      country,
      slug: urlSlug,
      badgePath,
      accentColor,
    });

    const events: NormalizedMatch[] = [];
    const rawEvents = Array.isArray(stage.Events) ? stage.Events : [];
    for (const ev of rawEvents) {
      const mapped = mapRawEventToMatch(ev, compSummary, referenceNowMs);
      if (mapped) events.push(mapped);
    }

    stages.push({ stageId, name: stageName, events });
  }

  return {
    compId,
    name,
    country,
    urlSlug,
    badgePath,
    accentColor,
    stages,
  };
}

export function mapCompetitionTable(
  raw: Record<string, unknown>,
  requestedCompId: string
): NormalizedStandingsResult {
  if (raw.normalized === undefined && raw.competitionId === undefined) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Competition table response missing required "normalized" or "competitionId" field.',
      { statusCode: 502, isTransient: false }
    );
  }
  const compId = optionalNumericId(raw.competitionId) ?? requestedCompId;
  const normalized = isPlainObject(raw.normalized) ? raw.normalized : null;
  if (!normalized || !Array.isArray(normalized.stages)) {
    return {
      compId,
      competitionName: null,
      available: false,
      tables: [],
    };
  }

  let competitionName: string | null = null;
  const tables: NormalizedStandingsTable[] = [];

  for (const stage of normalized.stages) {
    if (!isPlainObject(stage)) continue;
    if (!competitionName) {
      competitionName = optionalNonEmptyString(stage.competitionName);
    }
    const stageId = optionalNumericId(stage.stageId);
    const stageName = optionalNonEmptyString(stage.stageName) ?? competitionName ?? 'Table';
    const rawTables = Array.isArray(stage.tables) ? stage.tables : [];

    for (const tbl of rawTables) {
      if (!isPlainObject(tbl)) continue;
      const rawTeams = Array.isArray(tbl.teams) ? tbl.teams : [];
      const rows: NormalizedStandingsRow[] = [];

      for (const team of rawTeams) {
        if (!isPlainObject(team)) continue;
        const rank = optionalNonNegativeInt(team.rank);
        const teamName = optionalNonEmptyString(team.name);
        const played = optionalNonNegativeInt(team.played);
        const won = optionalNonNegativeInt(team.wins);
        const drawn = optionalNonNegativeInt(team.draws);
        const lost = optionalNonNegativeInt(team.losses);
        const goalsFor = optionalNonNegativeInt(team.goalsFor);
        const goalsAgainst = optionalNonNegativeInt(team.goalsAgainst);
        const goalDifference = optionalInt(team.goalDifference);
        const points = optionalInt(team.points);

        if (
          rank === null ||
          !teamName ||
          played === null ||
          won === null ||
          drawn === null ||
          lost === null ||
          goalsFor === null ||
          goalsAgainst === null ||
          goalDifference === null ||
          points === null
        ) {
          continue;
        }

        rows.push({
          rank,
          teamId: optionalNumericId(team.teamId),
          teamName,
          played,
          won,
          drawn,
          lost,
          goalsFor,
          goalsAgainst,
          goalDifference,
          points,
          badgePath: optionalNonEmptyString(team.image),
        });
      }

      if (rows.length > 0) {
        tables.push({
          stageId,
          stageName,
          tableType: optionalInt(tbl.type),
          rows,
        });
      }
    }
  }

  return {
    compId,
    competitionName,
    available: tables.length > 0,
    tables,
  };
}

/**
 * Maps /team/{id}/details while intentionally trimming heavy unused feed/news blobs
 * from the ~199 KB upstream payload before L1/L2 caching.
 */
export function mapTeamDetails(
  raw: Record<string, unknown>,
  requestedTeamId: string,
  referenceNowMs = Date.now()
): NormalizedTeamDetails {
  const teamId = optionalNumericId(raw.ID) ?? requestedTeamId;
  const name = requireNonEmptyString(raw.Nm, 'Nm');

  const recentAndUpcomingMatches: NormalizedMatch[] = [];
  const rawStages = Array.isArray(raw.Stages) ? raw.Stages : [];
  for (const stage of rawStages) {
    if (!isPlainObject(stage)) continue;
    const comp = mapCompetitionSummary(stage);
    const events = Array.isArray(stage.Events) ? stage.Events : [];
    for (const ev of events) {
      const mapped = mapRawEventToMatch(ev, comp, referenceNowMs);
      if (mapped) recentAndUpcomingMatches.push(mapped);
    }
  }

  return {
    teamId,
    name,
    shortCode: optionalNonEmptyString(raw.Abr),
    country: optionalNonEmptyString(raw.CoNm),
    badgePath: optionalNonEmptyString(raw.Img),
    primaryColor: optionalNonEmptyString(raw.firstColor),
    secondaryColor: optionalNonEmptyString(raw.secondColor),
    isNational: Boolean(raw.national),
    hasSquad: Boolean(raw.HasSquad),
    domesticCompId: optionalNumericId(raw.DomCompId),
    recentAndUpcomingMatches,
  };
}

function mapSquadPlayersList(rawPlayers: unknown): NormalizedSquadPlayer[] {
  if (!Array.isArray(rawPlayers)) return [];
  const players: NormalizedSquadPlayer[] = [];

  for (const p of rawPlayers) {
    if (!isPlainObject(p)) continue;
    // Canonical athlete ID is Aid (NOT Pid)
    const aid = optionalNumericId(p.Aid);
    if (!aid) continue;

    const firstName = optionalNonEmptyString(p.Fn);
    const lastName = optionalNonEmptyString(p.Ln);
    const fullName =
      optionalNonEmptyString(p.Pnm) ??
      ([firstName, lastName].filter(Boolean).join(' ') || null);
    if (!fullName) continue;

    players.push({
      aid,
      squadEntryId: optionalNumericId(p.Pid),
      fullName,
      firstName,
      lastName,
      slug: optionalNonEmptyString(p.Pnt),
      nationality: optionalNonEmptyString(p.CoNm),
      positionCode: optionalNonNegativeInt(p.Pos),
      shirtNumber: optionalNonNegativeInt(p.Snu),
      imageFile: optionalNonEmptyString(p.ImageUrl ?? p.imageUrl),
    });
  }

  return players;
}

export function mapTeamSquad(
  raw: Record<string, unknown>,
  requestedTeamId: string
): NormalizedTeamSquad {
  const teamId = optionalNumericId(raw.ID) ?? requestedTeamId;
  const teamName = requireNonEmptyString(raw.Nm, 'Nm');

  return {
    teamId,
    teamName,
    country: optionalNonEmptyString(raw.CoNm),
    badgePath: optionalNonEmptyString(raw.Img),
    players: mapSquadPlayersList(raw.Ps),
  };
}

export function mapPlayerTeammates(
  raw: Record<string, unknown>,
  requestedTeamId: string
): NormalizedTeamSquad {
  return mapTeamSquad(raw, requestedTeamId);
}

export function mapTeamPlayerStats(
  raw: Record<string, unknown>,
  compId: string,
  teamId: string,
  group: AllowedPlayerStatGroup
): NormalizedTeamPlayerStats {
  if (!Array.isArray(raw.players)) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Team player stats response missing required "players" array.',
      { statusCode: 502, isTransient: false }
    );
  }
  const rawPlayers = raw.players;
  const players: NormalizedTeamPlayerStatEntry[] = [];

  for (const p of rawPlayers) {
    if (!isPlainObject(p)) continue;
    const aid = optionalNumericId(p.id ?? p.Aid);
    const name = optionalNonEmptyString(p.name ?? p.Pnm);
    if (!aid || !name) continue;

    players.push({
      aid,
      name,
      slug: optionalNonEmptyString(p.Pnt),
      position: optionalNonEmptyString(p.position),
      teamId: optionalNumericId(p.participantId) ?? teamId,
      imageFile: optionalNonEmptyString(p.imageUrl),
    });
  }

  return {
    compId,
    teamId,
    group,
    players,
  };
}

export function mapPlayerProfile(
  raw: Record<string, unknown>,
  requestedAid: string
): NormalizedPlayerProfile {
  const playerObj = isPlainObject(raw.player) ? raw.player : null;
  if (!playerObj) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Player profile response missing required "player" object.',
      { statusCode: 502, isTransient: false }
    );
  }

  const aid = optionalNumericId(raw.id ?? playerObj.id) ?? requestedAid;
  const firstName = optionalNonEmptyString(playerObj.firstName);
  const lastName = optionalNonEmptyString(playerObj.lastName);
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ') ||
    optionalNonEmptyString(playerObj.name);
  if (!fullName) {
    throw new FootballProviderError(
      'UPSTREAM_SCHEMA_INVALID',
      'Player profile missing player name fields.',
      { statusCode: 502, isTransient: false }
    );
  }

  // Resolve current team info from currentInfo + participants lookup
  const participantsById = new Map<string, string>();
  if (Array.isArray(raw.participants)) {
    for (const part of raw.participants) {
      if (!isPlainObject(part)) continue;
      const pId = optionalNumericId(part.id);
      const pName = optionalNonEmptyString(part.name);
      if (pId && pName) participantsById.set(pId, pName);
    }
  }

  const currentInfo = isPlainObject(raw.currentInfo) ? raw.currentInfo : null;
  const currentPP =
    currentInfo && isPlainObject(currentInfo.playerParticipant)
      ? currentInfo.playerParticipant
      : null;

  const currentTeamId = currentPP ? optionalNumericId(currentPP.participantId) : null;
  const currentTeamName = currentTeamId ? participantsById.get(currentTeamId) ?? null : null;

  // Map career entries
  const career: NormalizedPlayerCareerEntry[] = [];
  if (Array.isArray(raw.career)) {
    for (const c of raw.career) {
      if (!isPlainObject(c) || !isPlainObject(c.part)) continue;
      const teamName = optionalNonEmptyString(c.part.name);
      if (!teamName) continue;
      career.push({
        teamId: optionalNumericId(c.part.id),
        teamName,
        country: optionalNonEmptyString(c.part.reg),
        badgePath: optionalNonEmptyString(c.part.badgeUrl),
        startIso: parseOptionalDateIso(c.start),
        endIso: parseOptionalDateIso(c.end),
      });
    }
  }

  // Map tournaments & seasons (note: raw.clEvents is an object, intentionally ignored here)
  const tournaments: NormalizedPlayerTournamentEntry[] = [];
  if (Array.isArray(raw.tournaments)) {
    for (const t of raw.tournaments) {
      if (!isPlainObject(t)) continue;
      const tName = optionalNonEmptyString(t.name);
      if (!tName) continue;

      const seasons: NormalizedPlayerTournamentEntry['seasons'] = [];
      if (Array.isArray(t.seasons)) {
        for (const s of t.seasons) {
          if (!isPlainObject(s)) continue;
          const sName = optionalNonEmptyString(s.name);
          if (!sName) continue;
          const pp = isPlainObject(s.playerParticipant) ? s.playerParticipant : null;
          seasons.push({
            id: optionalNumericId(s.id),
            name: sName,
            teamId: pp ? optionalNumericId(pp.participantId) : null,
            position: pp ? optionalNonEmptyString(pp.position) : null,
            shirtNumber: pp ? optionalNonNegativeInt(pp.shirtNumber) : null,
          });
        }
      }

      tournaments.push({
        id: optionalNumericId(t.id),
        name: tName,
        code: optionalNonEmptyString(t.code),
        seasons,
      });
    }
  }

  return {
    aid,
    firstName,
    lastName,
    fullName,
    nationalityCode: optionalNonEmptyString(playerObj.regAbr),
    heightCm: optionalNonNegativeInt(playerObj.h),
    birthDateIso: parseOptionalDateIso(playerObj.bd),
    imageFile: optionalNonEmptyString(playerObj.imageUrl),
    currentTeamId,
    currentTeamName,
    position: currentPP ? optionalNonEmptyString(currentPP.position) : null,
    shirtNumber: currentPP ? optionalNonNegativeInt(currentPP.shirtNumber) : null,
    career,
    tournaments,
  };
}
