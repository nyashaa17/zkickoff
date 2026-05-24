const fetch = require('node-fetch');
fetch('https://sports.bzzoiro.com/docs/v2/').then(res => res.text()).then(t => console.log(t.substring(0, 100000)));
