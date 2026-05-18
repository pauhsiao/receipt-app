async function fetchUS(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const j = await r.json();
  const prices = j.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  if (prices.length < 2) return null;
  const prev = prices[prices.length - 2];
  const last = prices[prices.length - 1];
  const pct = ((last - prev) / prev * 100).toFixed(2);
  return { last: last.toFixed(2), pct, up: pct >= 0 };
}

async function fetchFutures() {
  try {
    const r = await fetch('https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_MTX00.tw&json=1&delay=0');
    const j = await r.json();
    const d = j.msgArray?.[0];
    if (!d) return null;
    const z = parseFloat(d.z);
    const y = parseFloat(d.y);
    const diff = (z - y).toFixed(0);
    return { z, y, diff, up: z >= y };
  } catch { return null; }
}

async function sendPushover(token, user, title, message) {
  await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, user, title, message, html: 1, priority: 0 }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const token = process.env.PUSHOVER_TOKEN;
  const user  = process.env.PUSHOVER_USER;
  if (!token || !user) return res.status(500).json({ error: 'missing env' });

  const [sp, ixic, sox, futures] = await Promise.all([
    fetchUS('^GSPC'),
    fetchUS('^IXIC'),
    fetchUS('^SOX'),
    fetchFutures(),
  ]);

  const arrow = v => v?.up ? '▲' : '▼';
  const sign  = v => v?.up ? '+' : '';

  const spLine  = sp    ? `S&P 500：${arrow(sp)} ${sign(sp)}${sp.pct}%` : 'S&P 500：無法取得';
  const ixicLine= ixic  ? `那斯達克：${arrow(ixic)} ${sign(ixic)}${ixic.pct}%` : '那斯達克：無法取得';
  const soxLine = sox   ? `費半(SOX)：${arrow(sox)} ${sign(sox)}${sox.pct}% ← 台積電指標` : '費半：無法取得';
  const futLine = futures ? `台指期：${futures.z}（${futures.diff >= 0 ? '+' : ''}${futures.diff}點 vs 昨收）` : '台指期：無法取得';

  // 氣氛判斷
  let sentiment = '中';
  const soxOk = sox && parseFloat(sox.pct) > 0.5;
  const futOk = futures && parseFloat(futures.diff) > 30;
  const soxBad = sox && parseFloat(sox.pct) < -0.5;
  const futBad = futures && parseFloat(futures.diff) < -30;
  if (soxOk && futOk) sentiment = '強 💪';
  else if (soxBad && futBad) sentiment = '弱 😬';

  const msg = [
    '<b>🇺🇸 美股昨收</b>',
    spLine,
    ixicLine,
    soxLine,
    '',
    '<b>🇹🇼 台指期</b>',
    futLine,
    '',
    `<b>📌 今日開盤預估氣氛：${sentiment}</b>`,
    '',
    '💡 開盤後30分鐘決定方向，注意觀察！',
  ].join('\n');

  await sendPushover(token, user, '⏰ 盤感訓練｜開盤前情報 08:43', msg);
  return res.status(200).json({ ok: true });
}
