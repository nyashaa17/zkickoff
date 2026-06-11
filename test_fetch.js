fetch('http://localhost:3000/api/test_bzz').then(r => r.json()).then(d => {
  console.log(JSON.stringify(d, null, 2));
}).catch(console.error);

