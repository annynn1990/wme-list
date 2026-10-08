import { get, put } from "@vercel/blob";

const PATH = "households.json";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

const emptyData = () => ({ version: 1, updatedAt: new Date().toISOString(), households: [] });

function send(res, body, status = 200) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      const result = await get(PATH, { access: "private", useCache: false });
      if (!result) return send(res, emptyData());
      const text = await new Response(result.stream).text();
      res.status(200);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
      return res.end(text);
    } catch (error) {
      return send(res, emptyData());
    }
  }

  if (req.method !== "PUT") return send(res, { error: "Method Not Allowed" }, 405);

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.households)) return send(res, { error: "資料格式錯誤" }, 400);

    const households = body.households.map((item, index) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
      name: String(item.name ?? "").trim(),
      address: String(item.address ?? "").trim()
    }));

    const data = { version: 1, updatedAt: new Date().toISOString(), households };

    await put(PATH, JSON.stringify(data, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });

    return send(res, data);
  } catch (error) {
    return send(res, { error: "儲存住戶資料失敗" }, 500);
  }
}
