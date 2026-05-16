export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 未設定' });

  const { image_base64, media_type } = req.body;
  const now = new Date();
  const nowDate = now.toISOString().split('T')[0];
  const nowTime = now.toTimeString().slice(0, 8);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 },
            },
            {
              type: 'text',
              text: `你是帳單識別助理，支援繁體中文、簡體中文、英文、韓文、日文、西班牙文、捷克語、德文。

請分析這張帳單圖片，只回傳以下 JSON，不要其他文字：
{"merchant_name":"商家名稱或空字串","date":"YYYY-MM-DD日期，若無用${nowDate}","time":"HH:MM:SS時間，若無用${nowTime}","currency":"貨幣代碼如TWD USD JPY","items":[{"name":"品項","amount":金額}],"total":總金額數字,"confidence":"high或medium或low"}

若不是帳單或無法識別：{"error":"無法識別帳單"}`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: `API錯誤 ${response.status}`, detail: data });

    const text = data.content?.[0]?.text?.trim() || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: '無法解析回應', raw: text.slice(0, 200) });

    return res.json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
