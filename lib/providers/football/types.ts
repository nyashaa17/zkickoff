import 'server-only';

/**
 * Normalized Football Provider Contracts (Phase 3 Stage 3.2)
 *
 * Strict data-authenticity rules:
 * - Missing or unavailable fields MUST be `null` (never fabricated strings like
 *   "Stadium" or "24,500", and never `0` when a value was not supplied).
 * - Match scores MUST be `null` for not-started / postponed / cancelled matches
 *   and `{ home: 0, away: 0 }` ONLY when the match is actually LIVE or FINISHED.
 */

export type NormalizedMatchStatus =
  | 'LIVE'
  | 'TODAY'
  | 'UPCOMING'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type AllowedPlayerStatGroup = 'goals' | 'shots' | 'saves' | 'fouls';

export interface NormalizedScore {
  home: number;
  away: number;
}

export interface NormalizedTeamSummary {
  /** TotalSportsLive team ID (e.g. "2871"), null if absent from payload */
  id: string | null;
  name: string;
  shortCode: string | null;
  badgePath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface NormalizedCompetitionSummary {
  /** TotalSportsLive CompId (e.g. "65") — required for /competition/{id}/* endpoints */
  compId: string | null;
  /** TotalSportsLive Stage/Season ID (e.g. "25545") */
  stageId: string | null;
  name: string;
  country: string | null;
  slug: string | null;
  badgePath: string | null;
  accentColor: string | null;
}

export interface NormalizedMatch {
  /** Canonical TotalSportsLive Event ID (Eid) */
  id: string;
  slug: string;
  status: NormalizedMatchStatus;
  rawStatusCode: string | null;
  minute: number | null;
  /** Kickoff timestamp in ISO-8601 UTC when parseable, else null */
  kickoffIso: string | null;
  /** Raw YYYYMMDDHHMMSS string from upstream if valid, else null */
  rawEsd: string | null;
  homeTeam: NormalizedTeamSummary;
  awayTeam: NormalizedTeamSummary;
  /** Null for not-started / postponed / cancelled matches; numeric only when LIVE or FINISHED */
  score: NormalizedScore | null;
  halfTimeScore: NormalizedScore | null;
  competition: NormalizedCompetitionSummary;
  venueName: string | null;
}

export interface NormalizedFixturesResult {
  date: string; // YYYYMMDD
  matches: NormalizedMatch[];
}

export interface NormalizedReferee {
  name: string;
  country: string | null;
  imageFile: string | null;
}

export interface NormalizedMatchInfo {
  eventId: string;
  kickoffIso: string | null;
  venueName: string | null;
  city: string | null;
  country: string | null;
  attendance: number | null;
  isNeutralVenue: boolean | null;
  referees: NormalizedReferee[];
}

export interface NormalizedMatchIncident {
  period: string;
  minute: number | null;
  teamNumber: 1 | 2 | null;
  incidentTypeCode: number | null;
  playerId: string | null; // Canonical Aid
  playerName: string | null;
  playerSlug: string | null; // Pnt
  shirtNumber: number | null;
}

export interface NormalizedTeamMatchStatLine {
  teamNumber: 1 | 2;
  possessionPct: number | null;
  shotsOnTarget: number | null;
  shotsOffTarget: number | null;
  shotsBlocked: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  yellowCards: number | null;
  redCards: number | null;
  goalkeeperSaves: number | null;
  expectedGoals: number | null;
}

export interface NormalizedMatchStatistics {
  eventId: string;
  available: boolean;
  teams: NormalizedTeamMatchStatLine[];
}

export interface NormalizedLineupPlayer {
  /** Canonical athlete ID (Aid) */
  aid: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  slug: string | null; // Pnt
  position: string | null;
  shirtNumber: number | null;
  formationSlot: string | null;
  rating: number | null;
  ratingNote: string | null;
  imageFile: string | null;
}

export interface NormalizedTeamLineup {
  teamNumber: 1 | 2;
  starters: NormalizedLineupPlayer[];
}

export interface NormalizedMatchLineups {
  eventId: string;
  available: boolean;
  teams: NormalizedTeamLineup[];
}

export interface NormalizedMatchForm {
  eventId: string;
  homeRecentMatches: NormalizedMatch[];
  awayRecentMatches: NormalizedMatch[];
}

export interface NormalizedCompetitionDetails {
  compId: string;
  name: string;
  country: string | null;
  urlSlug: string | null;
  badgePath: string | null;
  accentColor: string | null;
  stages: {
    stageId: string | null;
    name: string;
    events: NormalizedMatch[];
  }[];
}

export interface NormalizedStandingsRow {
  rank: number;
  teamId: string | null;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  badgePath: string | null;
}

export interface NormalizedStandingsTable {
  stageId: string | null;
  stageName: string;
  tableType: number | null;
  rows: NormalizedStandingsRow[];
}

export interface NormalizedStandingsResult {
  compId: string;
  competitionName: string | null;
  available: boolean;
  tables: NormalizedStandingsTable[];
}

export interface NormalizedTeamDetails {
  teamId: string;
  name: string;
  shortCode: string | null;
  country: string | null;
  badgePath: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  isNational: boolean;
  hasSquad: boolean;
  domesticCompId: string | null;
  recentAndUpcomingMatches: NormalizedMatch[];
}

export interface NormalizedSquadPlayer {
  /** Canonical Athlete ID (Aid) used for /player/{aid} */
  aid: string;
  /** Squad entry ID (Pid), distinct from Aid */
  squadEntryId: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  slug: string | null; // Pnt
  nationality: string | null;
  positionCode: number | null;
  shirtNumber: number | null;
  imageFile: string | null;
}

export interface NormalizedTeamSquad {
  teamId: string;
  teamName: string;
  country: string | null;
  badgePath: string | null;
  players: NormalizedSquadPlayer[];
}

export interface NormalizedPlayerCareerEntry {
  teamId: string | null;
  teamName: string;
  country: string | null;
  badgePath: string | null;
  startIso: string | null;
  endIso: string | null;
}

export interface NormalizedPlayerTournamentEntry {
  id: string | null;
  name: string;
  code: string | null;
  seasons: {
    id: string | null;
    name: string;
    teamId: string | null;
    position: string | null;
    shirtNumber: number | null;
  }[];
}

export interface NormalizedPlayerProfile {
  /** Canonical Athlete ID (Aid) */
  aid: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  nationalityCode: string | null;
  heightCm: number | null;
  birthDateIso: string | null;
  imageFile: string | null;
  currentTeamId: string | null;
  currentTeamName: string | null;
  position: string | null;
  shirtNumber: number | null;
  career: NormalizedPlayerCareerEntry[];
  tournaments: NormalizedPlayerTournamentEntry[];
}

export interface NormalizedTeamPlayerStatEntry {
  aid: string;
  name: string;
  slug: string | null;
  position: string | null;
  teamId: string | null;
  imageFile: string | null;
}

export interface NormalizedTeamPlayerStats {
  compId: string;
  teamId: string;
  group: AllowedPlayerStatGroup;
  players: NormalizedTeamPlayerStatEntry[];
}

// -----------------------------------------------------------------------------
// Cache Metadata & Controlled Provider Error Types
// -----------------------------------------------------------------------------

export type ProviderCacheSource = 'L1_HIT' | 'L2_HIT' | 'STALE' | 'UPSTREAM';

export interface ProviderCacheMetadata {
  source: ProviderCacheSource;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
  degraded: boolean;
}

export type FootballProviderErrorCode =
  | 'INVALID_INPUT'
  | 'BLOCKED_ENDPOINT'
  | 'COORDINATION_UNAVAILABLE'
  | 'UPSTREAM_BUDGET_EXCEEDED'
  | 'UPSTREAM_COOLDOWN'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_HTTP_ERROR'
  | 'UPSTREAM_INVALID_CONTENT_TYPE'
  | 'UPSTREAM_HTML_ERROR'
  | 'UPSTREAM_MALFORMED_JSON'
  | 'UPSTREAM_SCHEMA_INVALID'
  | 'NOT_FOUND';

export class FootballProviderError extends Error {
  readonly code: FootballProviderErrorCode;
  readonly statusCode: number;
  readonly retryAfter?: number;
  readonly isTransient: boolean;

  constructor(
    code: FootballProviderErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      retryAfter?: number;
      isTransient?: boolean;
    }
  ) {
    super(message);
    this.name = 'FootballProviderError';
    this.code = code;
    this.statusCode = options?.statusCode ?? 503;
    this.retryAfter = options?.retryAfter;
    this.isTransient = options?.isTransient ?? false;
  }
}

export type ProviderResult<T> =
  | {
      ok: true;
      data: T;
      cache: ProviderCacheMetadata;
    }
  | {
      ok: false;
      error: FootballProviderError;
      staleData?: T;
      cache?: ProviderCacheMetadata;
    };
