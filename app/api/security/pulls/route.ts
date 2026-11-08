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
  const ranks={critical:0,high:1,medium:2,low:3};
  const candidates=pulls.filter((p:ReturnType<typeof parsePull>)=>p.state==='open'&&p.risk?.level==='low').sort((a:ReturnType<typeof parsePull>,b:ReturnType<typeof parsePull>)=>ranks[a.risk!.priority]-ranks[b.risk!.priority]);
  for(const p of candidates){const queued=await securityDb().rpc("queue_security_automatic_merge",{pull_number:p.number,head_sha:p.head,base_sha:p.base});if(queued.error)throw Error("Automatic merge queue unavailable");if(queued.data)break;}
  if(results.some((r:{status:string})=>r.status === "blocked")) await sendSecurityAlerts();
  return Response.json({accepted:true});
 }catch{return Response.json({error:"PR review update rejected"},{status:400});}
}

export async function GET(request:Request){
 let claims;try{claims=await verifySecurityWorkflow(request);}catch{return Response.json({allowed:false},{status:401});}
 const id=new URL(request.url).searchParams.get("id");if(!id||!/^[-a-f0-9]{36}$/.test(id))return Response.json({allowed:false},{status:400});
 const{data,error}=await securityDb().rpc("authorize_security_automatic_merge",{command_id:id,rid:claims.run_id});
 return Response.json({allowed:!error&&data===true},{status:error?503:200});
}
