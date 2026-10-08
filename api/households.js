import { get, put } from "@vercel/blob";

const PATH = "households.json";

const emptyData = { version: 1, updatedAt: new Date().toISOString(), households: [] };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function GET() {
  try {
    const result = await get(PATH, { access: "private", useCache: false });
    if (!result) return json(emptyData);
    const text = await new Response(result.stream).text();
    return new Response(text, { status: 200, headers: {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"
    }});
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("not found")) return json(emptyData);
    return json({ error: "讀取住戶資料失敗" }, 500);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    if (!body || !Array.isArray(body.households)) return json({ error: "資料格式錯誤" }, 400);
    const households = body.households.map((item, index) => ({
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
      name: String(item.name ?? "").trim(),
      address: String(item.address ?? "").trim()
    }));
    const data = { version: 1, updatedAt: new Date().toISOString(), households };
    await put(PATH, JSON.stringify(data, null, 2), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json"
    });
    return json(data);
  } catch (error) {
    return json({ error: "儲存住戶資料失敗" }, 500);
  }
}
