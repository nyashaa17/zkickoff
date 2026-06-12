import assert from 'node:assert/strict';
import test from 'node:test';

import { formatEsTime, parseRawEventToMatch, slugify, type ListEventRaw } from '../lib/totalsports-api';

function makeEvent(overrides: Partial<ListEventRaw> = {}): ListEventRaw {
  return {
    Eid: '12345',
    T1: [{ Nm: 'Dynamos FC', Img: 'dynamos.png', ID: '18' }],
    T2: [{ Nm: 'Highlanders FC', ID: '20' }],
    Esd: '20260612193000',
    Eps: 'NS',
    ...overrides,
  };
}

test('slugify normalizes punctuation and whitespace into URL-safe slugs', () => {
  assert.equal(slugify('  CAPS United vs. Manica Diamonds!  '), 'caps-united-vs-manica-diamonds');
});

test('formatEsTime extracts kickoff time and falls back for missing or malformed values', () => {
  assert.equal(formatEsTime('20260612193000'), '19:30');
  assert.equal(formatEsTime(20260612080500), '08:05');
  assert.equal(formatEsTime(undefined), '15:00');
  assert.equal(formatEsTime('202606'), '15:00');
});

test('parseRawEventToMatch maps raw events into live match cards', () => {
  const match = parseRawEventToMatch(
    makeEvent({ Eps: '1H', Ela: '34', Tr1: '2', Tr2: '1' }),
    'Zimbabwe Premier Soccer League',
    'Zimbabwe',
  );

  assert.equal(match.status, 'LIVE');
  assert.equal(match.minute, 34);
  assert.deepEqual(match.score, { home: 2, away: 1 });
  assert.equal(match.category, 'ZPSL');
  assert.equal(match.kickoffTime, '19:30');
  assert.equal(match.slug, 'dynamos-fc-vs-highlanders-fc-12345');
  assert.equal(match.teams.home.lsBadge, 'https://static.livescore.com/v2/images/teams/large/dynamos.png');
  assert.equal(match.teams.away.lsBadge, 'https://static.livescore.com/v2/images/teams/large/t20.png');
});

test('parseRawEventToMatch marks yesterday and finished events as finished', () => {
  assert.equal(parseRawEventToMatch(makeEvent({ Eps: 'FT' }), 'Premier League', 'England').status, 'FINISHED');
  assert.equal(parseRawEventToMatch(makeEvent({ Eps: 'NS' }), 'Premier League', 'England', 'Yesterday').status, 'FINISHED');
});
