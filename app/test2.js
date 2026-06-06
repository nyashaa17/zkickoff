const https = require('https');
https.get('https://king.totalsportslive.co.zw/api/livescore?date=20260607&t=' + Date.now(), (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
     let parsed = JSON.parse(data);
     let firstEvent = parsed.Stages?.[0]?.Events?.[0];
     if (firstEvent) {
       console.log("Date in first event:", firstEvent.Esd);
     } else {
       console.log("No events");
     }
  })
});
