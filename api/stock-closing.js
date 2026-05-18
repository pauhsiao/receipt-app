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
  let instLines = '三大法人：資料準備中';
  let top5 = '', bot5 = '';

  try {
    const [allRes, instRes] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/T86'),
    ]);

    const all = await allRes.json();
    const stocks = all.filter(s => /^\d{4}$/.test(s.Code) && s.Change);
    const sorted = stocks
      .map(s => ({ ...s, chg: parseFloat(s.Change) || 0 }))
      .sort((a, b) => b.chg - a.chg);

    // 大盤：找加權指數（Code = '0001' or 'Y9999'）
    const idx = all.find(s => s.Code === 'Y9999' || s.Code === '0001');
    if (idx) {
      indexLine = `加權指數：${idx.ClosingPrice}（${idx.Change >= 0 ? '+' : ''}${idx.Change}）`;
    } else {
      const totalVol = stocks.reduce((acc, s) => acc + (parseFloat(s.TradeVolume) || 0), 0);
      indexLine = `今日共 ${stocks.length} 檔交易`;
    }

    top5 = sorted.slice(0, 5)
      .map(s => `${s.Code} ${s.Name}　+${s.chg.toFixed(2)}`)
      .join('\n');
    bot5 = sorted.slice(-5).reverse()
      .map(s => `${s.Code} ${s.Name}　${s.chg.toFixed(2)}`)
      .join('\n');

    // 三大法人
    const inst = await instRes.json();
    const foreign = inst
      .filter(s => /^\d{4}$/.test(s.Code))
      .map(s => ({
        ...s,
        fNet: parseInt((s.Foreign_Investor_Buy_Sell || '0').replace(/,/g, '')) || 0,
      }))
      .sort((a, b) => b.fNet - a.fNet);

    const buyTop3 = foreign.slice(0, 3)
      .map(s => `${s.Code} ${s.Name}　+${s.fNet.toLocaleString()}張`)
      .join('\n');
    const sellTop3 = foreign.slice(-3).reverse()
      .map(s => `${s.Code} ${s.Name}　${s.fNet.toLocaleString()}張`)
      .join('\n');

    instLines = `<b>💰 外資買超前3</b>\n${buyTop3}\n\n<b>💸 外資賣超前3</b>\n${sellTop3}`;
  } catch (e) {
    instLines = `資料錯誤：${e.message}`;
  }

  const msg = [
    `<b>📊 收盤總結</b>`,
    indexLine,
    '',
    instLines,
    '',
    `<b>🏆 今日漲幅前5</b>`,
    top5,
    '',
    `<b>❌ 今日跌幅前5</b>`,
    bot5,
    '',
    '📝 <b>覆盤提醒</b>',
    '1. 今天最強族群的原因是什麼？',
    '2. 外資買的明天值得觀察嗎？',
    '3. 記得填今天的記錄表！',
  ].join('\n');

  await sendPushover(token, user, '⏰ 盤感訓練｜收盤覆盤 14:33', msg);
  return res.status(200).json({ ok: true });
}
