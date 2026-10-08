import { get, put } from "@vercel/blob";

const PATH = "households.json";
const EDIT_PASSWORD = "6666";

const ADDRESS_MIGRATION = {
  "忠烈亭": "杜泰區國民大街一巷一號",
  "悠然草堂": "杜泰區國民大街一巷二號",
  "胡宅": "杜泰區國民大街一巷三號",
  "杜泰居": "杜泰區國民大街一巷四號",
  "文宣閣": "杜泰區國民大街一巷五號",
  "帝國文相府": "杜泰區國民大街一巷六號",
  "晴朗山莊": "杜泰區國民大街一巷七號",
  "輝聲居": "杜泰區國民大街一巷八號",
  "青天華園": "杜泰區國民大街一巷九號",
  "泰親王府": "杜泰區國民大街一巷十號",
  "嘉親王府": "杜泰區國民大街二巷一號",
  "南瀛府": "杜泰區國民大街二巷二號",
  "崇安閣": "杜泰區國民大街二巷三號",
  "雲霞山莊": "杜泰區國民大街二巷四號",
  "景泰居": "杜泰區國民大街二巷五號"
};

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

function migrateAddresses(data) {
  if (!data || !Array.isArray(data.households)) return { data, changed: false };

  let changed = false;
  const households = data.households.map((item) => {
    const newAddress = ADDRESS_MIGRATION[String(item.name ?? "").trim()];
    if (newAddress && item.address !== newAddress) {
      changed = true;
      return { ...item, address: newAddress };
    }
    return item;
  });

  if (!changed) return { data, changed: false };

  return {
    changed: true,
    data: {
      ...data,
      version: 3,
      updatedAt: new Date().toISOString(),
      households
    }
  };
}

async function readData() {
  try {
    const result = await get(PATH, { access: "private", useCache: false });
    if (!result) return { version: 3, updatedAt: new Date().toISOString(), households: [] };

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.households)) parsed.households = [];

    const migrated = migrateAddresses(parsed);
    if (migrated.changed) {
      await put(PATH, JSON.stringify(migrated.data, null, 2), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json"
      });
      return migrated.data;
    }

    return parsed;
  } catch {
    return { version: 3, updatedAt: new Date().toISOString(), households: [] };
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

    const households = body.households.map((item, index) => ({
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

    const migrated = migrateAddresses({
      version: 3,
      updatedAt: new Date().toISOString(),
      households
    });

    const data = migrated.data;

    await put(PATH, JSON.stringify(data, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });

    return send(res, data);
  } catch {
    return send(res, { error: "儲存住戶資料失敗" }, 500);
  }
}
