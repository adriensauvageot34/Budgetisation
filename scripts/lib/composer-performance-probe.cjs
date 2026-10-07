// Audit only: preload in an isolated runtime. No business writes or RPC permitted.
const fs = require('node:fs');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const http = require('node:http');
const out = process.env.COMPOSER_PERF_OUTPUT;
if (!out) throw new Error('COMPOSER_PERF_OUTPUT_REQUIRED');
fs.mkdirSync(out, { recursive: true });
const als = new AsyncLocalStorage();
let nextId = 0, events = [], timer;
const clock = () => performance.timeOrigin + performance.now();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function emit(event) {
  events.push({ pid: process.pid, ...event });
  if (!timer) timer = setTimeout(flush, 250).unref();
}
function flush() {
  timer = undefined;
  if (!events.length) return;
  const batch = events; events = [];
  fs.appendFileSync(`${out}/server-${process.pid}.jsonl`, batch.map(e => JSON.stringify(e)).join('\n') + '\n');
}
emit({type:'startup',timeOrigin:performance.timeOrigin,epoch:clock(),hrtimeMicro:Number(process.hrtime.bigint()/1000n),replay:Boolean(process.env.COMPOSER_PERF_REPLAY)});
globalThis.__composerPerf = function(name, fn) {
  const parent = als.getStore(), id = ++nextId, start = clock();
  const context = { id, root: parent?.root ?? id, name };
  function end(value, error) {
    const finish = clock();
    emit({ type: 'span', id, root: context.root, parent: parent?.id ?? null, name, start, end: finish, duration: finish-start,
      error: error ? String(error.code ?? error.name ?? 'ERROR') : null });
    if (name.endsWith(':composerUiModel') && value) {
      const payload = JSON.stringify(value), groups = {};
      for (const [key, child] of Object.entries(value)) {
        const raw = JSON.stringify(child); if (raw) groups[key] = { bytes: Buffer.byteLength(raw), gzipBytes: zlib.gzipSync(raw).length };
      }
      emit({ type: 'payload', root: context.root, bytes: Buffer.byteLength(payload), gzipBytes: zlib.gzipSync(payload).length,
        groups, fullUiDigest: hash(payload), digest: value.board?.draft?.semanticStateDigest, cards: (value.board?.baselineControls?.length??0)+(value.board?.discretionaryControls?.length??0)+(value.board?.savings?.length??0),
        contexts: value.board?.contexts?.length, assets: value.library?.searchableAssets?.length });
    }
    return value;
  }
  return als.run(context, () => {
    try {
      const result = fn();
      if (result && typeof result.then === 'function') return result.then(v=>end(v),e=>{end(null,e);throw e;});
      return end(result);
    } catch (error) { end(null,error); throw error; }
  });
};
const originalEmit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
  if(event!=='request')return originalEmit.call(this,event,...args);
  const [request,response]=args,parent=als.getStore(),id=++nextId,start=clock(),context={id,root:parent?.root??id,name:'http:'+request.method+':'+request.url.split('?')[0]};
  response.once('finish',()=>emit({type:'http',id,root:context.root,parent:parent?.id??null,name:context.name,start,end:clock(),duration:clock()-start,status:response.statusCode}));
  return als.run(context,()=>originalEmit.call(this,event,...args));
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const address = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  let url; try { url = new URL(address); } catch { return originalFetch(input, init); }
  if (!url.hostname.endsWith('.supabase.co')) return originalFetch(input,init);
  const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
  const business = /^\/(rest|storage)\/v1\//.test(url.pathname);
  const blocked = business && (!['GET','HEAD'].includes(method) || url.pathname.includes('/rpc/'));
  const context=als.getStore(), id=++nextId, start=clock();
  const parameters = [...url.searchParams].sort(([a],[b])=>a.localeCompare(b));
  const exact = hash(JSON.stringify([url.pathname,parameters]));
  const filters = parameters.map(([key,value])=>({key, value:['select','order','limit','offset'].includes(key) ? value : value.split('.')[0]+'.<'+hash(value).slice(0,12)+'>'}));
  const headers = new Headers(init?.headers ?? input?.headers);
  const auth = headers.get('authorization') ?? '', privileged = auth.includes('sb_secret_');
  const token = auth.replace(/^Bearer /i,'');
  let role = privileged?'service_role':'unknown';
  try { if (token.split('.').length===3) role=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).role??role; } catch {}
  const base={type:'fetch',id,root:context?.root??null,parent:context?.id??null,callSite:context?.name??'unscoped',method,path:url.pathname,business,blocked,role,exact,filters,start};
  // Private query metadata contains only predicates, never row data, tokens or passwords.
  if (business && process.env.COMPOSER_PERF_PRIVATE_QUERIES === '1') fs.appendFileSync(`${out}/private-queries-${process.pid}.jsonl`, JSON.stringify({id,exact,path:url.pathname,parameters})+'\n');
  if(blocked){emit({...base,end:clock(),error:'REMOTE_WRITE_FORBIDDEN'});throw new Error('COMPOSER_AUDIT_REMOTE_WRITE_FORBIDDEN');}
  try {
    let response;
    if(process.env.COMPOSER_PERF_REPLAY){
      const filename=`${process.env.COMPOSER_PERF_REPLAY}/${exact}.json`;
      if(!fs.existsSync(filename))throw new Error('AUDIT_REPLAY_MISSING:'+url.pathname+':'+exact);
      const cached=JSON.parse(fs.readFileSync(filename,'utf8'));
      await new Promise(resolve=>setTimeout(resolve,cached.latency*Number(process.env.COMPOSER_PERF_LATENCY_SCALE??1)));
      response=new Response(cached.body,{status:cached.status,headers:{'content-type':'application/json'}});
    }else response=await originalFetch(input,init);
    const headersAt=clock();
    emit({...base,headersAt,headerDuration:headersAt-start,status:response.status});
    const json=response.json.bind(response), responseText=response.text.bind(response);
    response.text=async()=>{
      const parseStart=clock(), raw=await responseText(), end=clock(), byteStart=clock(); let rows=null,errorCode=null;
      if((business||url.pathname==='/auth/v1/user')&&process.env.COMPOSER_PERF_CAPTURE==='1'){
        const folder=`${out}/private-replay`;fs.mkdirSync(folder,{recursive:true});
        fs.writeFileSync(`${folder}/${exact}.json`,JSON.stringify({status:response.status,body:raw,latency:headersAt-start}));
      }
      if(business) try {const data=JSON.parse(raw); rows=Array.isArray(data)?data.length:data===null?0:1; errorCode=!response.ok?data?.code:null;}catch{}
      emit({type:'body',id,root:base.root,parent:base.parent,path:base.path,start:parseStart,end,duration:end-start,totalDuration:end-start,
        rows,bytes:Buffer.byteLength(raw),measureOverhead:clock()-byteStart,errorCode}); return raw;
    };
    response.json=async()=>{
      const parseStart=clock();
      try { const result=await json(), end=clock(), byteStart=clock(), raw=JSON.stringify(result);
        if((business||url.pathname==='/auth/v1/user')&&process.env.COMPOSER_PERF_CAPTURE==='1'){
          const folder=`${out}/private-replay`;fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(`${folder}/${exact}.json`,JSON.stringify({status:response.status,body:raw,latency:headersAt-start}));
        }
        emit({type:'body',id,root:base.root,parent:base.parent,path:base.path,start:parseStart,end,duration:end-start,totalDuration:end-start,
          rows:Array.isArray(result)?result.length:result===null?0:1,bytes:Buffer.byteLength(raw??''),measureOverhead:clock()-byteStart,
          errorCode:!response.ok?result?.code:null}); return result;
      } catch(error){emit({type:'body',id,path:base.path,end:clock(),error:String(error.name)});throw error;}
    };
    return response;
  } catch(error){emit({...base,end:clock(),error:String(error.name)});throw error;}
};
process.on('exit',flush);
