const https = require('https');
https.get('https://storage.livescore.com/images/team/medium/chelsea.png', (res) => {
  console.log('chelsea', res.statusCode);
});
https.get('https://storage.livescore.com/images/team/medium/13.png', (res) => {
  console.log('13', res.statusCode);
});
https.get('https://storage.livescore.com/images/team/medium/18.png', (res) => {
  console.log('18', res.statusCode);
});
https.get('https://storage.livescore.com/images/team/medium/t18.png', (res) => {
  console.log('t18', res.statusCode);
});
