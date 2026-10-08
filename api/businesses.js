import { get, put } from "@vercel/blob";

const PATH = "businesses.json";
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


function migrateBusinesses(items) {
  const addressMap = {
    "黃名帝國中央銀行": "杜泰區商事大街一巷一號",
    "黃名皇家銀行": "杜泰區商事大街一巷二號",
    "維多利亞集團": "杜泰區商事大街一巷三號",
    "德意志飛船公司": "杜泰區商事大街一巷四號",
    "聯合集團": "杜泰區商事大街一巷五號",
    "興業銀行": "杜泰區商事大街一巷六號",
    "Trollyco": "杜泰區商事大街一巷七號",
    "天官行庫黃名分公司": "杜泰區商事大街一巷八號",
    "諸羅商行": "杜泰區商事大街一巷九號",
    "靖康未來事件交易所": "杜泰區商事大街一巷十號",
    "黃名帝國中央賭場": "杜泰區商事大街二巷一號",
    "景王銀行": "杜泰區商事大街二巷二號",
    "哆夢AI工作室": "杜泰區商事大街二巷三號",
    "華爵集團": "杜泰區商事大街二巷四號"
  };

  const current = Array.isArray(items) ? items : [];
  let changed = false;

  for (const item of current) {
    const next = addressMap[item.name];
    if (next && item.address !== next) {
      item.address = next;
      changed = true;
    }
  }

  if (!current.some(item => item.name === "黃名帝國中央賭場")) {
    current.push({
      id: Date.now(),
      name: "黃名帝國中央賭場",
      address: addressMap["黃名帝國中央賭場"],
      registrant: "國營事業",
      year: "2023",
      rentPaidYear: "",
      rentSupplementYear: "",
      rentMissedSince: "",
      rentState: "",
      rentStateYear: ""
    });
    changed = true;
  }

  return { items: current, changed };
}

async function readData() {
  try {
    const result = await get(PATH, { access: "private", useCache: false });
    if (!result) {
      return { version: 1, updatedAt: new Date().toISOString(), households: [] };
    }
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.households)) parsed.households = [];

    const migration = migrateBusinesses(parsed.households);
    parsed.households = migration.items;

    if (migration.changed) {
      parsed.updatedAt = new Date().toISOString();
      await put(PATH, JSON.stringify(parsed, null, 2), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json"
      });
    }

    return parsed;
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), households: [] };
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    Object.entries(cors).forEach(([k,v]) => res.setHeader(k,v));
    return res.status(204).end();
  }

  if (req.method === "GET") return send(res, await readData());

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

    let households = body.households.map((item, index) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
      name: String(item.name ?? "").trim(),
      address: String(item.address ?? "").trim(),
      registrant: String(item.registrant ?? "").trim(),
      year: String(item.year ?? "").trim(),
      rentPaidYear: String(item.rentPaidYear ?? "").trim(),
      rentSupplementYear: String(item.rentSupplementYear ?? "").trim(),
      rentMissedSince: String(item.rentMissedSince ?? "").trim(),
      rentState: String(item.rentState ?? "").trim(),
      rentStateYear: String(item.rentStateYear ?? "").trim()
    }));

    households = migrateBusinesses(households).items;

    const data = {
      version: 1,
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
  } catch {
    return send(res, { error: "儲存單位資料失敗" }, 500);
  }
}
