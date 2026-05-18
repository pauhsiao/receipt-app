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

  let indexLine = '大盤：無法取得';
  let breadthLine = '';
  let volumeLine = '';
  let top5Lines = '';

  try {
    const [idxRes, allRes] = await Promise.all([
      fetch('https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
    ]);

    const idxJson = await idxRes.json();
    const d = idxJson.msgArray?.[0];
    if (d) {
      const z = parseFloat(d.z);
      const y = parseFloat(d.y);
      const diff = (z - y).toFixed(2);
      const tv = d.tv ? `${(parseFloat(d.tv) / 100000).toFixed(0)}億` : '計算中';
      indexLine = `加權指數：${z.toFixed(2)}（${diff >= 0 ? '+' : ''}${diff}點）　成交量：${tv}`;
    }

    const all = await allRes.json();
    const stocks = all.filter(s => /^\d{4}$/.test(s.Code) && s.Change && s.Change !== '0.00');
    const sorted = stocks
      .map(s => ({ ...s, chg: parseFloat(s.Change) || 0 }))
      .sort((a, b) => b.chg - a.chg);

    const up   = sorted.filter(s => s.chg > 0).length;
    const down = sorted.filter(s => s.chg < 0).length;
    breadthLine = `上漲：${up} 家　下跌：${down} 家`;

    const top5 = sorted.slice(0, 5);
    top5Lines = top5.map(s => `${s.Code} ${s.Name}　+${s.chg.toFixed(2)}`).join('\n');
  } catch (e) {
    indexLine = `資料抓取錯誤：${e.message}`;
  }

  const msg = [
    '<b>📊 大盤即時</b>',
    indexLine,
    breadthLine,
    '',
    '<b>🔥 今日漲幅前5名</b>',
    top5Lines,
    '',
    '💡 問自己：今天最強族群是什麼？有消息嗎？',
  ].join('\n');

  await sendPushover(token, user, '⏰ 盤感訓練｜午盤快報 12:02', msg);
  return res.status(200).json({ ok: true });
}
