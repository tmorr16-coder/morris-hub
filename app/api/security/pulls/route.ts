import { verifySecurityWorkflow } from "@/lib/security/auth";
import { securityDb, sendSecurityAlerts } from "@/lib/security/server";
import { parsePull } from "@/lib/security/pulls";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
 let claims;
 try { claims=await verifySecurityWorkflow(request); } catch { return Response.json({error:"Unauthorized workflow"},{status:401}); }
 try {
  const reader=request.body?.getReader();if(!reader)throw Error("Missing body");let size=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4_000_000){await reader.cancel();throw Error("Too large");}chunks.push(value);}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(body.runId!==claims.run_id || !Array.isArray(body.pulls)||body.pulls.length>30||!Array.isArray(body.results)||body.results.length>30)throw Error("Invalid report");
  const pulls=body.pulls.map(parsePull);
  const results=body.results.map((r:{id:string;status:string;message:string})=>{if(!r||!/^[-a-f0-9]{36}$/.test(r.id)||!["merged","blocked"].includes(r.status)||typeof r.message!=="string"||r.message.length>1000)throw Error("Invalid result");return r;});
  const result=await securityDb().rpc("record_security_pulls",{rid:claims.run_id,pulls,results});
  if(result.error)throw Error("Persistence failed");
  if(results.some((r:{status:string})=>r.status === "blocked")) await sendSecurityAlerts();
  return Response.json({accepted:true});
 }catch{return Response.json({error:"PR review update rejected"},{status:400});}
}
