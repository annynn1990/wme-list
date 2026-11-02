import { get, put } from "@vercel/blob";

const PATH = "privy-council.json";
const LEGACY_URL = "https://raw.githubusercontent.com/annynn1990/wme-list/main/data.json";
const EDIT_PASSWORD = process.env.PRIVY_EDIT_PASSWORD || process.env.EDIT_PASSWORD || "1111";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Edit-Password",
  "Cache-Control": "no-store"
};

function send(res, body, status = 200) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

async function readLegacyData() {
  const response = await fetch(LEGACY_URL + "?ts=" + Date.now(), {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("GitHub 舊資料讀取失敗（HTTP " + response.status + "）");
  const data = await response.json();
  if (!data || typeof data.savedHTML !== "string") {
    throw new Error("GitHub 舊資料格式錯誤");
  }
  return { savedHTML: data.savedHTML, source: "github" };
}

async function readData() {
  const blob = await get(PATH, { access: "private", useCache: false });
  if (blob) {
    const raw = await new Response(blob.stream).text();
    const data = JSON.parse(raw);
    if (!data || !data.savedData || typeof data.savedData.table !== "string") {
      throw new Error("雲端職官資料格式錯誤");
    }
    return { ...data, source: "blob" };
  }

  // 第一次使用時沿用既有 GitHub data.json，不覆寫、不建立空白資料。
  return readLegacyData();
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      return send(res, await readData());
    } catch (error) {
      return send(res, { error: error.message || "讀取司憲院職官資料失敗" }, 502);
    }
  }

  if (req.method === "POST") {
    let body;
    try {
      body = parseBody(req);
    } catch {
      return send(res, { error: "請求資料格式錯誤" }, 400);
    }

    if (body.action !== "verify" || body.password !== EDIT_PASSWORD) {
      return send(res, { error: "管理密碼錯誤" }, 403);
    }
    return send(res, { ok: true });
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "GET, POST, PUT, OPTIONS");
    return send(res, { error: "Method Not Allowed" }, 405);
  }

  if (req.headers["x-edit-password"] !== EDIT_PASSWORD) {
    return send(res, { error: "未授權，請重新登入管理員帳戶" }, 403);
  }

  try {
    const body = parseBody(req);
    const savedData = body && body.savedData;

    if (
      !savedData ||
      typeof savedData.header !== "string" ||
      typeof savedData.table !== "string" ||
      typeof savedData.footer !== "string"
    ) {
      return send(res, { error: "職官表資料格式錯誤" }, 400);
    }

    if (
      savedData.header.length > 100000 ||
      savedData.table.length > 1000000 ||
      savedData.footer.length > 20000
    ) {
      return send(res, { error: "資料內容超出允許大小" }, 413);
    }

    const record = {
      version: 1,
      updatedAt: new Date().toISOString(),
      savedData
    };

    await put(PATH, JSON.stringify(record, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });

    return send(res, { ...record, source: "blob" });
  } catch (error) {
    return send(res, { error: error.message || "雲端儲存司憲院職官資料失敗" }, 500);
  }
}
