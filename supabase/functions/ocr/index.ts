import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { image_base64, media_type } = await req.json();

    const now = new Date();
    const nowDate = now.toISOString().split("T")[0];
    const nowTime = now.toTimeString().slice(0, 8);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: media_type || "image/jpeg",
                  data: image_base64,
                },
              },
              {
                type: "text",
                text: `你是帳單識別助理，支援繁體中文、簡體中文、英文、韓文、日文、西班牙文、捷克語、德文。

請分析這張帳單圖片，回傳以下 JSON 格式（只回傳 JSON，不要其他文字）：
{
  "merchant_name": "商家名稱（若無則為空字串）",
  "date": "YYYY-MM-DD（帳單上的日期，若無則用今天 ${nowDate}）",
  "time": "HH:MM:SS（帳單上的時間，若無則用現在 ${nowTime}）",
  "currency": "貨幣代碼（如 TWD、USD、JPY、EUR、KRW、CZK 等，無法判斷則用 TWD）",
  "items": [
    {"name": "品項名稱", "amount": 金額數字}
  ],
  "total": 總金額數字,
  "confidence": "high/medium/low（識別信心度）"
}

若圖片不是帳單或無法識別，回傳：{"error": "無法識別帳單"}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text.trim();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { error: "解析失敗", raw: text };
    }

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
