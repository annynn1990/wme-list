'use strict';

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 10000);
const TOKEN = process.env.GH_WRITE_TOKEN || '';
const PASSWORD = process.env.EDIT_PASSWORD || '';
const OWNER = process.env.GITHUB_OWNER || 'annynn1990';
const REPO = process.env.GITHUB_REPO || 'wme-list';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const FILE = process.env.GITHUB_DATA_PATH || 'data/households-live.json';
const LEGACY_URL = process.env.LEGACY_IMPORT_URL || 'https://wme-list.vercel.app/api/households';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Edit-Password',
  'Cache-Control': 'no-store'
};

function send(res, status, data) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8'
  }, CORS));
  res.end(JSON.stringify(data));
}

function passwordMatches(candidate) {
  if (!PASSWORD || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(PASSWORD, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function githubHeaders(json) {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wme-households-api'
  };
  if (TOKEN) h.Authorization = 'Bearer ' + TOKEN;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function contentsUrl(withRef) {
  const path = FILE.split('/').map(encodeURIComponent).join('/');
  let url = 'https://api.github.com/repos/' + encodeURIComponent(OWNER) + '/' +
    encodeURIComponent(REPO) + '/contents/' + path;
  if (withRef) url += '?ref=' + encodeURIComponent(BRANCH);
  return url;
}

async function readGitHubSnapshot() {
  const r = await fetch(contentsUrl(true), {
    headers: githubHeaders(false),
    signal: AbortSignal.timeout(15000)
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub 讀取失敗（HTTP ' + r.status + '）');

  const item = await r.json();
  if (!item || typeof item.content !== 'string') throw new Error('GitHub 資料檔格式錯誤');
  const raw = Buffer.from(item.content.replace(/\s/g, ''), 'base64').toString('utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.households)) throw new Error('GitHub 資料檔缺少住戶清單');

  return { data: data, sha: item.sha };
}

async function readLegacyData() {
  const r = await fetch(LEGACY_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error('原有住戶資料來源讀取失敗（HTTP ' + r.status + '）');

  const data = await r.json();
  if (!data || !Array.isArray(data.households)) throw new Error('原有住戶資料格式錯誤');
  return data;
}

async function writeGitHubSnapshot(data, message) {
  if (!TOKEN) {
    const e = new Error('GitHub 寫入憑證尚未設定，資料未儲存。');
    e.statusCode = 503;
    throw e;
  }

  const existing = await readGitHubSnapshot();
  const payload = {
    message: (message || 'Update household directory data') + ' [skip render]',
    branch: BRANCH,
    content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64')
  };
  if (existing && existing.sha) payload.sha = existing.sha;

  const r = await fetch(contentsUrl(false), {
    method: 'PUT',
    headers: githubHeaders(true),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  if (!r.ok) {
    const detail = (await r.text().catch(() => '')).slice(0, 220);
    const e = new Error('GitHub 儲存失敗（HTTP ' + r.status + '）' + detail);
    e.statusCode = r.status === 409 || r.status === 422 ? 409 : 502;
    throw e;
  }
}

async function getData() {
  const saved = await readGitHubSnapshot();
  if (saved) return saved.data;

  // 第一次切換時先讀原有住戶資料，成功後再匯入，不建立空白名單。
  const legacy = await readLegacyData();
  if (TOKEN) {
    const imported = Object.assign({}, legacy, {
      version: 3,
      updatedAt: legacy.updatedAt || new Date().toISOString()
    });
    await writeGitHubSnapshot(imported, 'Import existing household directory');
    return imported;
  }
  return legacy;
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) {
      const e = new Error('資料過大');
      e.statusCode = 413;
      throw e;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (_) {
    const e = new Error('JSON 格式錯誤');
    e.statusCode = 400;
    throw e;
  }
}

function normalizeData(input) {
  if (!input || !Array.isArray(input.households)) {
    const e = new Error('資料格式錯誤');
    e.statusCode = 400;
    throw e;
  }

  const households = input.households.map(function (item, index) {
    return {
      id: Number.isFinite(Number(item.id)) ? Number(item.id) : index + 1,
      name: String(item.name == null ? '' : item.name).trim(),
      address: String(item.address == null ? '' : item.address).trim(),
      registrant: String(item.registrant == null ? '' : item.registrant).trim(),
      year: String(item.year == null ? '' : item.year).trim(),
      rentPaidYear: String(item.rentPaidYear == null ? '' : item.rentPaidYear).trim(),
      rentSupplementYear: String(item.rentSupplementYear == null ? '' : item.rentSupplementYear).trim(),
      rentMissedSince: String(item.rentMissedSince == null ? '' : item.rentMissedSince).trim(),
      rentState: String(item.rentState == null ? '' : item.rentState).trim(),
      rentStateYear: String(item.rentStateYear == null ? '' : item.rentStateYear).trim()
    };
  });

  return { version: 3, updatedAt: new Date().toISOString(), households: households };
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (url.pathname === '/health') {
    return send(res, 200, {
      ok: true,
      githubWriteConfigured: Boolean(TOKEN),
      editPasswordConfigured: Boolean(PASSWORD)
    });
  }
  if (url.pathname !== '/api/households') return send(res, 404, { error: 'Not Found' });

  try {
    if (req.method === 'GET') return send(res, 200, await getData());

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action !== 'verify') return send(res, 400, { error: '未知操作' });
      if (!passwordMatches(body.password)) return send(res, 403, { error: '密碼錯誤或管理密碼尚未設定' });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'PUT') {
      if (!passwordMatches(req.headers['x-edit-password'])) return send(res, 403, { error: '未授權' });
      const data = normalizeData(await readBody(req));
      await writeGitHubSnapshot(data, 'Update household directory');
      return send(res, 200, data);
    }

    res.setHeader('Allow', 'GET,POST,PUT,OPTIONS');
    return send(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    return send(res, error.statusCode || 502, { error: error.message || '住戶資料服務發生錯誤' });
  }
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('wme-households-api listening on ' + PORT);
});
