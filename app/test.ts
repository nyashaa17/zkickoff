async function run() {
  const res = await fetch('https://king.totalsportslive.co.zw/api/livescore?date=20260607');
  const d = await res.json();
  console.log(d.Stages?.[0]?.Events?.[0]?.Esd);
}
run();
