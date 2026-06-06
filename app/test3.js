const https = require('https');
https.get('https://cap.totalsportslive.co.zw/api/stats?competition=premier-league&dateOrCategory=england&sport=football', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
     console.log("Stats Response status:", res.statusCode);
  });
}).on('error', (e) => {
  console.log("Stats Error:", e);
});

https.get('https://app.totalsportss.online/match-buttons/1186714', (res) => { // Example matchId, we don't have a real one here. 
  console.log("Buttons response:", res.statusCode);
}).on('error', (e) => {
  console.log("Buttons Error:", e);
});
