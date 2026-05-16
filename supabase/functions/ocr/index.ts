import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY 未設定" }), { headers: CORS });
  }

  try {
    const { image_base64, media_type } = await req.json();

    const now = new Date();
    const nowDate = now.toISOString().split("T")[0];
    const nowTime = now.toTimeString().slice(0, 8);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
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

請分析這張帳單圖片，只回傳以下 JSON，不要其他文字：
{"merchant_name":"商家名稱或空字串","date":"YYYY-MM-DD日期，若無用${nowDate}","time":"HH:MM:SS時間，若無用${nowTime}","currency":"貨幣代碼如TWD USD JPY","items":[{"name":"品項","amount":金額}],"total":總金額數字,"confidence":"high或medium或low"}

若不是帳單或無法識別：{"error":"無法識別帳單"}`,
              },
            ],
          },
        ],
      }),
    });

    const raw = await response.text();
    console.log("Anthropic status:", response.status);
    console.log("Anthropic response:", raw.slice(0, 500));

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `API錯誤 ${response.status}`, detail: raw.slice(0, 300) }), { headers: CORS });
    }

    const data = JSON.parse(raw);
    const text = data.content?.[0]?.text?.trim() || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "無法從回應中找到JSON", raw: text.slice(0, 200) }), { headers: CORS });
    }

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), { headers: CORS });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
