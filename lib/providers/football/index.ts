import 'server-only';
import {
  AllowedPlayerStatGroup,
  FootballProviderError,
  NormalizedCompetitionDetails,
  NormalizedFixturesResult,
  NormalizedMatch,
  NormalizedMatchForm,
  NormalizedMatchIncident,
  NormalizedMatchInfo,
  NormalizedMatchLineups,
  NormalizedMatchStatistics,
  NormalizedPlayerProfile,
  NormalizedStandingsResult,
  NormalizedTeamDetails,
  NormalizedTeamPlayerStats,
  NormalizedTeamSquad,
  ProviderResult,
} from './types';
import {
  ALLOWED_PLAYER_STAT_GROUPS,
  assertValidDateYYYYMMDD,
  assertValidNumericId,
  assertValidStatGroup,
} from './validation';
import {
  executeCoordinatedFetch,
  clearFootballProviderL1Cache,
  FootballCachePolicy,
} from './coordination-adapter';
import {
  fetchCompetitionDetails,
  fetchCompetitionTable,
  fetchLivescoreByDate,
  fetchMatchForm,
  fetchMatchIncidents,
  fetchMatchInfo,
  fetchMatchLineups,
  fetchMatchScoreboard,
  fetchMatchStatistics,
  fetchPlayerProfile,
  fetchPlayerTeammates,
  fetchTeamDetails,
  fetchTeamPlayerStats,
  fetchTeamSquad,
} from './totalsportslive-client';
import {
  mapCompetitionDetails,
  mapCompetitionTable,
  mapLivescoreDateResponse,
  mapMatchForm,
  mapMatchIncidents,
  mapMatchInfo,
  mapMatchLineups,
  mapMatchScoreboard,
  mapMatchStatistics,
  mapPlayerProfile,
  mapPlayerTeammates,
  mapTeamDetails,
  mapTeamPlayerStats,
  mapTeamSquad,
} from './totalsportslive-mapper';

export * from './types';
export { ALLOWED_PLAYER_STAT_GROUPS, clearFootballProviderL1Cache };

export const FOOTBALL_CACHE_POLICIES: Record<string, FootballCachePolicy> = {
  livescoreDate: { freshTtlSeconds: 60, staleWindowSeconds: 300 },
  matchScoreboard: { freshTtlSeconds: 30, staleWindowSeconds: 180 },
  matchInfo: { freshTtlSeconds: 600, staleWindowSeconds: 3600 },
  matchIncidents: { freshTtlSeconds: 30, staleWindowSeconds: 300 },
  matchStatistics: { freshTtlSeconds: 45, staleWindowSeconds: 300 },
  matchLineups: { freshTtlSeconds: 120, staleWindowSeconds: 900 },
  matchForm: { freshTtlSeconds: 900, staleWindowSeconds: 3600 },
  competitionDetails: { freshTtlSeconds: 1800, staleWindowSeconds: 7200 },
  competitionTable: { freshTtlSeconds: 300, staleWindowSeconds: 1800 },
  teamDetails: { freshTtlSeconds: 900, staleWindowSeconds: 3600 },
  teamSquad: { freshTtlSeconds: 3600, staleWindowSeconds: 14400 },
  teamPlayerStats: { freshTtlSeconds: 1800, staleWindowSeconds: 7200 },
  playerProfile: { freshTtlSeconds: 3600, staleWindowSeconds: 14400 },
  playerTeammates: { freshTtlSeconds: 3600, staleWindowSeconds: 14400 },
};

function handleInputError<T>(err: unknown): ProviderResult<T> {
  if (err instanceof FootballProviderError) {
    return { ok: false, error: err };
  }
  return {
    ok: false,
    error: new FootballProviderError(
      'INVALID_INPUT',
      err instanceof Error ? err.message : 'Invalid provider input.',
      { statusCode: 400, isTransient: false }
    ),
  };
}

// -----------------------------------------------------------------------------
// Verified Football Data Provider Facade
// -----------------------------------------------------------------------------

export async function getFixturesByDate(
  date: string
): Promise<ProviderResult<NormalizedFixturesResult>> {
  let validDate: string;
  try {
    validDate = assertValidDateYYYYMMDD(date);
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `livescore:date:${validDate}`,
    FOOTBALL_CACHE_POLICIES.livescoreDate,
    async () => {
      const raw = await fetchLivescoreByDate(validDate);
      return mapLivescoreDateResponse(raw, validDate);
    }
  );
}

export async function getMatchScoreboard(
  eventId: string
): Promise<ProviderResult<NormalizedMatch>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:scoreboard`,
    FOOTBALL_CACHE_POLICIES.matchScoreboard,
    async () => {
      const raw = await fetchMatchScoreboard(validId);
      return mapMatchScoreboard(raw);
    },
    { matchId: validId }
  );
}

export async function getMatchInfo(
  eventId: string
): Promise<ProviderResult<NormalizedMatchInfo>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:info`,
    FOOTBALL_CACHE_POLICIES.matchInfo,
    async () => {
      const raw = await fetchMatchInfo(validId);
      return mapMatchInfo(raw, validId);
    },
    { matchId: validId }
  );
}

export async function getMatchIncidents(
  eventId: string
): Promise<ProviderResult<NormalizedMatchIncident[]>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:incidents`,
    FOOTBALL_CACHE_POLICIES.matchIncidents,
    async () => {
      const raw = await fetchMatchIncidents(validId);
      return mapMatchIncidents(raw);
    },
    { matchId: validId }
  );
}

export async function getMatchStatistics(
  eventId: string
): Promise<ProviderResult<NormalizedMatchStatistics>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:statistics`,
    FOOTBALL_CACHE_POLICIES.matchStatistics,
    async () => {
      const raw = await fetchMatchStatistics(validId);
      return mapMatchStatistics(raw, validId);
    },
    { matchId: validId }
  );
}

export async function getMatchLineups(
  eventId: string
): Promise<ProviderResult<NormalizedMatchLineups>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:lineups`,
    FOOTBALL_CACHE_POLICIES.matchLineups,
    async () => {
      const raw = await fetchMatchLineups(validId);
      return mapMatchLineups(raw, validId);
    },
    { matchId: validId }
  );
}

export async function getMatchForm(
  eventId: string
): Promise<ProviderResult<NormalizedMatchForm>> {
  let validId: string;
  try {
    validId = assertValidNumericId(eventId, 'eventId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `match:${validId}:form`,
    FOOTBALL_CACHE_POLICIES.matchForm,
    async () => {
      const raw = await fetchMatchForm(validId);
      return mapMatchForm(raw, validId);
    },
    { matchId: validId }
  );
}

export async function getCompetitionDetails(
  compId: string
): Promise<ProviderResult<NormalizedCompetitionDetails>> {
  let validCompId: string;
  try {
    validCompId = assertValidNumericId(compId, 'compId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `competition:${validCompId}:details`,
    FOOTBALL_CACHE_POLICIES.competitionDetails,
    async () => {
      const raw = await fetchCompetitionDetails(validCompId);
      return mapCompetitionDetails(raw, validCompId);
    }
  );
}

export async function getCompetitionTable(
  compId: string
): Promise<ProviderResult<NormalizedStandingsResult>> {
  let validCompId: string;
  try {
    validCompId = assertValidNumericId(compId, 'compId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `competition:${validCompId}:table`,
    FOOTBALL_CACHE_POLICIES.competitionTable,
    async () => {
      const raw = await fetchCompetitionTable(validCompId);
      return mapCompetitionTable(raw, validCompId);
    }
  );
}

export async function getTeamDetails(
  teamId: string
): Promise<ProviderResult<NormalizedTeamDetails>> {
  let validTeamId: string;
  try {
    validTeamId = assertValidNumericId(teamId, 'teamId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `team:${validTeamId}:details`,
    FOOTBALL_CACHE_POLICIES.teamDetails,
    async () => {
      const raw = await fetchTeamDetails(validTeamId);
      return mapTeamDetails(raw, validTeamId);
    }
  );
}

export async function getTeamSquad(
  teamId: string
): Promise<ProviderResult<NormalizedTeamSquad>> {
  let validTeamId: string;
  try {
    validTeamId = assertValidNumericId(teamId, 'teamId');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `team:${validTeamId}:squad`,
    FOOTBALL_CACHE_POLICIES.teamSquad,
    async () => {
      const raw = await fetchTeamSquad(validTeamId);
      return mapTeamSquad(raw, validTeamId);
    }
  );
}

export async function getTeamPlayerStats(
  compId: string,
  teamId: string,
  group: AllowedPlayerStatGroup | string
): Promise<ProviderResult<NormalizedTeamPlayerStats>> {
  let validCompId: string;
  let validTeamId: string;
  let validGroup: AllowedPlayerStatGroup;
  try {
    validCompId = assertValidNumericId(compId, 'compId');
    validTeamId = assertValidNumericId(teamId, 'teamId');
    validGroup = assertValidStatGroup(group);
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `competition:${validCompId}:team:${validTeamId}:stats:${validGroup}`,
    FOOTBALL_CACHE_POLICIES.teamPlayerStats,
    async () => {
      const raw = await fetchTeamPlayerStats(validCompId, validTeamId, validGroup);
      return mapTeamPlayerStats(raw, validCompId, validTeamId, validGroup);
    }
  );
}

export async function getPlayerProfile(
  aid: string
): Promise<ProviderResult<NormalizedPlayerProfile>> {
  let validAid: string;
  try {
    validAid = assertValidNumericId(aid, 'aid');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `player:${validAid}:profile`,
    FOOTBALL_CACHE_POLICIES.playerProfile,
    async () => {
      const raw = await fetchPlayerProfile(validAid);
      return mapPlayerProfile(raw, validAid);
    }
  );
}

export async function getPlayerTeammates(
  teamId: string,
  aid: string
): Promise<ProviderResult<NormalizedTeamSquad>> {
  let validTeamId: string;
  let validAid: string;
  try {
    validTeamId = assertValidNumericId(teamId, 'teamId');
    validAid = assertValidNumericId(aid, 'aid');
  } catch (err) {
    return handleInputError(err);
  }

  return executeCoordinatedFetch(
    `team:${validTeamId}:player:${validAid}:teammates`,
    FOOTBALL_CACHE_POLICIES.playerTeammates,
    async () => {
      const raw = await fetchPlayerTeammates(validTeamId, validAid);
      return mapPlayerTeammates(raw, validTeamId);
    }
  );
}

// -----------------------------------------------------------------------------
// Explicitly Blocked Upstream Endpoints (Never Contact Upstream)
// -----------------------------------------------------------------------------

export async function getUnifiedMatchH2H(_eventId: string): Promise<ProviderResult<never>> {
  return {
    ok: false,
    error: new FootballProviderError(
      'BLOCKED_ENDPOINT',
      'Endpoint /api/livescore/unified is blocked: upstream returns HTTP 400 Missing params.',
      { statusCode: 501, isTransient: false }
    ),
  };
}

export async function searchFootball(_query: string): Promise<ProviderResult<never>> {
  return {
    ok: false,
    error: new FootballProviderError(
      'BLOCKED_ENDPOINT',
      'Endpoint /api/livescore/search is blocked: upstream returns empty Sorting array.',
      { statusCode: 501, isTransient: false }
    ),
  };
}

export async function getTeamAssistsStats(
  _compId: string,
  _teamId: string
): Promise<ProviderResult<never>> {
  return {
    ok: false,
    error: new FootballProviderError(
      'BLOCKED_ENDPOINT',
      'Player stat group "assists" is blocked: upstream returns HTTP 502 HTML.',
      { statusCode: 501, isTransient: false }
    ),
  };
}

export const footballProvider = {
  getFixturesByDate,
  getMatchScoreboard,
  getMatchInfo,
  getMatchIncidents,
  getMatchStatistics,
  getMatchLineups,
  getMatchForm,
  getCompetitionDetails,
  getCompetitionTable,
  getTeamDetails,
  getTeamSquad,
  getTeamPlayerStats,
  getPlayerProfile,
  getPlayerTeammates,
  getUnifiedMatchH2H,
  searchFootball,
  getTeamAssistsStats,
};
