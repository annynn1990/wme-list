const HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function safeEqual(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export async function documentApi(context,key){
 const {request,env}=context;
 if(!env.DB)return json({error:"Cloudflare D1 尚未連接（缺少 DB 綁定）。"},503);
 if(request.method==="GET"){
  try{
   const row=await env.DB.prepare("SELECT payload FROM wme_documents WHERE document_key = ?1").bind(key).first();
   if(!row)return json({error:"資料庫尚未匯入這份名冊。"},404);
   return new Response(row.payload,{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  }catch(error){return json({error:error.message||"讀取資料庫失敗。"},500);}
 }
 if(request.method!=="POST"&&request.method!=="PUT")return json({error:"Method Not Allowed"},405);
 const expected=env.WME_EDIT_PASSWORD||"";
 if(!expected)return json({error:"尚未設定 Cloudflare Secret：WME_EDIT_PASSWORD。"},503);
 if(request.method==="POST"){
  let body;try{body=await request.json();}catch{return json({error:"JSON 格式錯誤。"},400);}
  if(body.action!=="verify")return json({error:"未知操作。"},400);
  if(!safeEqual(body.password,expected))return json({error:"管理密碼錯誤。"},403);
  return json({ok:true});
 }
 if(!safeEqual(request.headers.get("X-WME-Edit-Password"),expected))return json({error:"管理密碼錯誤，未儲存。"},403);
 let body;
 try{const raw=await request.text();if(raw.length>1048576)return json({error:"資料超過 1 MB 限制。"},413);body=JSON.parse(raw);}
 catch{return json({error:"JSON 格式錯誤。"},400);}
 const savedData=body.savedData;
 if(!savedData||!["header","table","footer"].every(k=>typeof savedData[k]==="string"))return json({error:"儲存資料必須包含 header、table、footer。"},400);
 try{
  const row=await env.DB.prepare("SELECT payload FROM wme_documents WHERE document_key = ?1").bind(key).first();
  if(!row)return json({error:"資料庫尚未匯入原始名冊，為避免覆蓋資料已停止儲存。"},404);
  const document=JSON.parse(row.payload),updatedAt=new Date().toISOString();
  document.version=document.version||1;document.updatedAt=updatedAt;document.savedHTML=savedData.table;
  document.savedData={header:savedData.header,table:savedData.table,footer:savedData.footer};
  await env.DB.prepare("UPDATE wme_documents SET payload = ?1, updated_at = ?2 WHERE document_key = ?3")
   .bind(JSON.stringify(document),updatedAt,key).run();
  return json({ok:true,updatedAt});
 }catch(error){return json({error:error.message||"資料庫儲存失敗。"},500);}
}
