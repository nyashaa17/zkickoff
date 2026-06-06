const https = require('https');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function getTeamColor(name) {
  return '#3B82F6';
}

function formatEsTime(esd) {
  if (esd === undefined || esd === null) return '15:00';
  const esdStr = String(esd);
  if (esdStr.length < 12) return '15:00';
  const hour = esdStr.slice(8, 10);
  const min = esdStr.slice(10, 12);
  return `${hour}:${min}`;
}

function parseRawEventToMatch(event, stageName, countryName, dateStringOption = 'Today') {
  const homeRaw = event.T1?.[0];
  const awayRaw = event.T2?.[0];

  const homeName = homeRaw?.Nm || 'Home Team';
  const awayName = awayRaw?.Nm || 'Away Team';
  const id = event.Eid;
  const slug = `${slugify(homeName)}-vs-${slugify(awayName)}-${id}`;

  const homeImg = homeRaw?.Img;
  const awayImg = awayRaw?.Img;
  const homeId = homeRaw?.ID;
  const awayId = awayRaw?.ID;

  let homeLsBadge = null;
  if (homeImg) {
    homeLsBadge = `https://static.livescore.com/v2/images/teams/large/${homeImg}`;
  } else if (homeId) {
    homeLsBadge = `https://static.livescore.com/v2/images/teams/large/t${homeId}.png`;
  }

  let awayLsBadge = null;
  if (awayImg) {
    awayLsBadge = `https://static.livescore.com/v2/images/teams/large/${awayImg}`;
  } else if (awayId) {
    awayLsBadge = `https://static.livescore.com/v2/images/teams/large/t${awayId}.png`;
  }

  const kickoffTime = formatEsTime(event.Esd);
  const eps = event.Eps || 'NS';
  const isFinished = ['FT', 'AET', 'AP', 'FT_PEN', 'POSTP', 'CANCL', 'Postp.', 'Canc.', 'Postp', 'Canc', 'Abd', 'Abd.'].includes(eps);
  const isLive = ['1H', 'HT', '2H', 'ET', 'Pen', 'LIVE'].includes(eps) || (!isFinished && !['NS', 'Postp', 'Canc', 'Postp.', 'Canc.', 'POSTP', 'CANCL', 'Abd', 'Abd.'].includes(eps));
  
  let status = 'UPCOMING';
  if (isLive) {
    status = 'LIVE';
  } else if (isFinished || dateStringOption === 'Yesterday') {
    status = 'FINISHED';
  } else if (dateStringOption === 'Today') {
    status = 'TODAY';
  } else {
    status = 'UPCOMING';
  }

  return {
    id,
    slug,
    teams: {
      home: { name: homeName, code: homeRaw?.Co || homeName.slice(0, 3).toUpperCase(), logoUrl: homeLsBadge || undefined },
      away: { name: awayName, code: awayRaw?.Co || awayName.slice(0, 3).toUpperCase(), logoUrl: awayLsBadge || undefined }
    },
    score: { home: event.Tr1 ? parseInt(event.Tr1, 10) : undefined, away: event.Tr2 ? parseInt(event.Tr2, 10) : undefined },
    status,
    minute: event.Ela ? parseInt(event.Ela, 10) : undefined,
    competition: stageName,
    kickoffTime,
    dateString: dateStringOption,
    category: 'INTERNATIONAL',
    venue: event.Vnm || undefined,
    servers: []
  };
}

https.get('https://king.totalsportslive.co.zw/api/livescore?date=20260607&t=' + Date.now(), (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
     let parsed = JSON.parse(data);
     const rawMatches = [];
     if (parsed.Stages) {
       parsed.Stages.forEach((stage) => {
         if (stage.Events) {
           stage.Events.forEach((eventItem) => {
             const m = parseRawEventToMatch(eventItem, stage.Snm, stage.Cnm, '07/06/2026');
             rawMatches.push(m);
           });
         }
       });
     }
     console.log("Success! Parsed matches count:", rawMatches.length);
     if (rawMatches.length > 0) {
       console.log("First parsed match:", JSON.stringify(rawMatches[0], null, 2));
     }
  })
}).on('error', e => {
  console.log("Request error:", e);
});
