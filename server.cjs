'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.GH_WRITE_TOKEN || '';
const PASSWORD = process.env.EDIT_PASSWORD || '';
const OWNER = 'annynn1990', REPO = 'wme-list', BRANCH = 'main';
const FILE = 'data/households-live.json';
const LEGACY = 'https://wme-list.vercel.app/api/households';
const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Edit-Password','Cache-Control':'no-store'};
function send(res, status, obj) { res.writeHead(status, Object.assign({'Content-Type':'application/json; charset=utf-8'},CORS)); res.end(JSON.stringify(obj)); }
function same(a,b) { if(typeof a!=='string'||!b)return false; const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && crypto.timingSafeEqual(x,y); }
function apiUrl(){ return 'https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/'+FILE; }
function headers(){ const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'wme-households-api'}; if(TOKEN)h.Authorization='Bearer '+TOKEN; return h; }
async function readGitHub(){
 const r=await fetch(apiUrl()+'?ref='+BRANCH,{headers:headers()});
 if(r.status===404)return null;
 if(!r.ok)throw new Error('GitHub read failed ('+r.status+')');
 const j=await r.json(); return {data:JSON.parse(Buffer.from(j.content.replace(/\\s/g,''),'base64').toString('utf8')),sha:j.sha};
}
async function readData(){
 const saved=await readGitHub(); if(saved)return saved.data;
 const r=await fetch(LEGACY,{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Could not read existing household data');
 const d=await r.json(); if(!Array.isArray(d.households))throw new Error('Invalid household data'); return d;
}
async function writeData(data){
 if(!TOKEN)throw new Error('GitHub write token is not configured');
 const old=await readGitHub();
 const payload={message:'Update household directory data',branch:BRANCH,content:Buffer.from(JSON.stringify(data,null,2)+'\\n').toString('base64')};
 if(old&&old.sha)payload.sha=old.sha;
 const r=await fetch(apiUrl(),{method:'PUT',headers:Object.assign(headers(),{'Content-Type':'application/json'}),body:JSON.stringify(payload)});
 if(!r.ok)throw new Error('GitHub save failed ('+r.status+')');
}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>2e6)throw new Error('Request too large');}return JSON.parse(s||'{}');}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='OPTIONS')return send(res,204,{});
 if(url.pathname==='/health')return send(res,200,{ok:true,githubReady:!!TOKEN,passwordReady:!!PASSWORD});
 if(url.pathname!=='/api/households')return send(res,404,{error:'Not Found'});
 try{
  if(req.method==='GET')return send(res,200,await readData());
  if(req.method==='POST'){const b=await body(req);return same(b.password,PASSWORD)?send(res,200,{ok:true}):send(res,403,{error:'密碼錯誤'});}
  if(req.method==='PUT'){if(!same(req.headers['x-edit-password'],PASSWORD))return send(res,403,{error:'未授權'});const d=await body(req);if(!d||!Array.isArray(d.households))return send(res,400,{error:'資料格式錯誤'});d.updatedAt=new Date().toISOString();await writeData(d);return send(res,200,d);}
  res.setHeader('Allow','GET,POST,PUT,OPTIONS');return send(res,405,{error:'Method Not Allowed'});
 }catch(e){return send(res,500,{error:e.message||'伺服器錯誤'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log('Household API listening on '+PORT));