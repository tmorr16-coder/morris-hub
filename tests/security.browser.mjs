// Render the real server page with an admin/data fixture; exercise responsive UI and filters.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ts from 'typescript';
import { chromium } from '@playwright/test';
const require=createRequire(import.meta.url);
const source=await readFile(new URL('../app/home/admin/security/page.tsx',import.meta.url),'utf8');
const css=await readFile(new URL('../app/home/admin/security/security.module.css',import.meta.url),'utf8');
const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
const now=new Date().toISOString();
const finding=(key,severity,resolved_at=null)=>({key,source:'dependencies',title:`${severity} dependency issue`,severity,location:'sample-package',url:'https://github.com/advisories/GHSA-abcd-1234-5678',remediation:'Review update',first_seen:now,last_seen:now,resolved_at});
const fixtures={config:{enabled:true,frequency:'daily',time:'07:17',weekday:1,version:1,next_due:now},requests:[],runs:[{run_id:'123',attempt:1,sha:'a'.repeat(40),completed:['dependencies','codeql'],errors:[],received_at:now}],findings:[finding('one','high'),finding('two','medium'),finding('three','low',now)],mail:[],stale:false};
const controlSource=await readFile(new URL('../app/home/admin/security/SecurityControls.tsx',import.meta.url),'utf8');
const controlCode=ts.transpileModule(controlSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const controlExports={};new Function('require','exports',controlCode)(id=>id==='next/navigation'?{useRouter:()=>({refresh:()=>{}})}:id==='./actions'?{requestSecurityScan:async()=>({}),saveSecuritySchedule:async()=>({})}:id==='./security.module.css'?{default:new Proxy({},{get:(_,key)=>key})}:require(id),controlExports);
const modules={'./PullQueue':{default:()=>React.createElement('section',{id:'pull-reviews'},'Review fixes')},'@/lib/security/pulls':{reviewHref:url=>url},'./FixNow':{default:()=>React.createElement('button',{},'Fix now')},'./SecurityControls':controlExports,'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},'next/navigation':{redirect:()=>{throw Error('redirect')}},'@/lib/supabase/auth-utils':{requireAdmin:async()=>({id:'fixture-admin'})},'@/lib/security/server':{securitySnapshot:async()=>fixtures},'@/lib/security/model':{RECIPIENT:'tmorr16@gmail.com',REPOSITORY:'tmorr16-coder/morris-hub'},'./security.module.css':{default:new Proxy({},{get:(_,key)=>key})}};
const exports={};new Function('require','exports',outputText)(id=>modules[id]??require(id),exports);
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const html=renderToStaticMarkup(await exports.default({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))}));res.writeHead(200,{'content-type':'text/html'});res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--ios-label:#152033;--ios-label-2:#516078;--ios-tint:#185adb;--ios-card:#fff;--ios-fill:#eef2f8;--ios-separator:#dce2ec;--ios-red:#bd213c}*{box-sizing:border-box}body{margin:0;background:#f5f7fc;font-family:Arial,sans-serif}${css}</style></head><body>${html}</body></html>`);}catch{res.writeHead(500);res.end('fixture failed')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const origin=`http://127.0.0.1:${server.address().port}`;await page.goto(origin);
 assert.equal(await page.locator('article.finding h3').count(),2);
 assert.equal(await page.getByRole('button',{name:'Scan now',exact:true}).count(),1);assert.equal(await page.locator('input[type=time]').inputValue(),'07:17');assert.equal(await page.getByRole('combobox',{name:/Frequency/}).inputValue(),'daily');await page.getByRole('combobox',{name:/Frequency/}).selectOption('weekly');
 await page.getByRole('combobox',{name:/Severity/}).selectOption('high');await page.getByRole('button',{name:'Apply filters'}).click();assert.equal(await page.locator('article.finding h3').count(),1);assert.match(await page.locator('article.finding h3').textContent(),/high/);
 await page.getByRole('link',{name:'Clear',exact:true}).click();await page.getByRole('combobox',{name:/Status/}).selectOption('resolved');await page.getByRole('button',{name:'Apply filters'}).click();assert.match(await page.locator('article.finding h3').textContent(),/low/);
 await page.goto(origin);await page.screenshot({path:'/tmp/morris-security-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/morris-security-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log('Security dashboard browser fixture passed: open/resolved/severity filters; desktop and mobile fit.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
