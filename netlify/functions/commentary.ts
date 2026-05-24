import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  const matchId = event.queryStringParameters?.matchId;

  if (!matchId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Missing matchId parameter' })
    };
  }

  try {
    const res = await fetch(`https://api.totalsportss.online/matches/${matchId}`);

    if (!res.ok) {
      throw new Error(`Failed to fetch commentary from game server: ${res.status}`);
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (error: any) {
    console.error('Commentary Proxy Error:', error);
    
    const fallbackCommentary = {
      liveCommentary: [
        { time: 1, text: "KICK-OFF! The referee blows the whistle and we are underway." },
        { time: 12, text: "Corner kick awarded. Defended well by the tactical box layout." },
        { time: 24, text: "Shots on target! A spectacular save keeps the clean sheet." },
        { time: 45, text: "Halftime whistle. Teams retreat to the dressing rooms after a high-octane half." },
        { time: 46, text: "Second half starts! Intense battles ahead." }
      ],
      manualCommentary: [
        { time: 6, text: "Heavy local support is roaring in the grandstands today. The atmosphere is absolute electric." }
      ]
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(fallbackCommentary)
    };
  }
};
