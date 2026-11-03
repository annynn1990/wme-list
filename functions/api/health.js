export function onRequestGet({env}){
 return Response.json({ok:true,d1Configured:Boolean(env.DB),passwordConfigured:Boolean(env.WME_EDIT_PASSWORD)},{headers:{"Cache-Control":"no-store"}});
}
