import { get, put } from "@vercel/blob";

const PATH = "households.json";
const EDIT_PASSWORD = "6666";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Edit-Password",
  "Cache-Control": "no-store"
};

function send(res, body, status = 200) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
  res.end(JSON.stringify(body));
}

async function readData() {
  try {
    const result = await get(PATH, { access: "private", useCache: false });
    if (!result) return { version: 2, updatedAt: new Date().toISOString(), households: [] };
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.households)) parsed.households = [];
    return parsed;
  } catch {
    return { version: 2, updatedAt: new Date().toISOString(), households: [] };
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return send(res, await readData());
  }

  if (req.method !== "PUT") {
    return send(res, { error: "Method Not Allowed" }, 405);
  }

  if (req.headers["x-edit-password"] !== EDIT_PASSWORD) {
    return send(res, { error: "未授權" }, 403);
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || !Array.isArray(body.households)) {
      return send(res, { error: "資料格式錯誤" }, 400);
    }

    const households = body.households.map((item, index) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
      name: String(item.name ?? "").trim(),
      address: String(item.address ?? "").trim(),
      registrant: String(item.registrant ?? "").trim(),
      year: String(item.year ?? "").trim()
    }));

    const data = {
      version: 2,
      updatedAt: new Date().toISOString(),
      households
    };

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
