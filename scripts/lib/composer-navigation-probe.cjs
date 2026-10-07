// Audit preload only: full HTTP timeline, no headers containing credentials/bodies.
require('./composer-performance-probe.cjs');
const fs=require('node:fs'),http=require('node:http'),os=require('node:os');
const {performance}=require('node:perf_hooks');
const out=process.env.COMPOSER_PERF_OUTPUT;
const clock=()=>performance.timeOrigin+performance.now();
let sequence=0,queue=[],timer;
function flush(){timer=undefined;if(queue.length){const batch=queue;queue=[];fs.appendFileSync(`${out}/navigation-${process.pid}.jsonl`,batch.map(JSON.stringify).join('\n')+'\n');}}
function log(value){queue.push({pid:process.pid,...value});if(!timer)timer=setTimeout(flush,250).unref();}
const measuredFetch=globalThis.fetch;
globalThis.fetch=async function(...args){try{return await measuredFetch(...args)}catch(e){log({type:'fetch-error-cause',at:clock(),name:e.name,code:e.code??null,causeCode:e.cause?.code??null});throw e}};
const previous=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
 if(event!=='request')return previous.call(this,event,...args);
 const[request,response]=args,u=new URL(request.url,'http://localhost');
 const meta={type:'http-navigation',id:++sequence,method:request.method,path:u.pathname,month:u.searchParams.get('month'),
  rsc:request.headers.rsc==='1',prefetch:request.headers['next-router-prefetch']==='1',segmentPrefetch:!!request.headers['next-router-segment-prefetch'],
  action:!!request.headers['next-action'],start:clock(),bytesWritten:0};
 const writeHead=response.writeHead,write=response.write,end=response.end;
 const size=chunk=>typeof chunk==='string'?Buffer.byteLength(chunk):chunk?.byteLength??0;
 response.writeHead=function(...a){meta.headersAt??=clock();return writeHead.apply(this,a)};
 response.write=function(...a){meta.firstWriteAt??=clock();meta.bytesWritten+=size(a[0]);return write.apply(this,a)};
 response.end=function(...a){meta.bytesWritten+=size(a[0]);return end.apply(this,a)};
 response.once('finish',()=>log({...meta,end:clock(),status:response.statusCode,contentType:response.getHeader('content-type')??null}));
 response.once('close',()=>{if(!response.writableFinished)log({...meta,type:'http-aborted',end:clock(),status:response.statusCode})});
 return previous.call(this,event,...args);
};
const sample=setInterval(()=>log({type:'process-sample',at:clock(),cpu:process.cpuUsage(),rss:process.memoryUsage().rss,heapUsed:process.memoryUsage().heapUsed,systemFreeBytes:os.freemem()}),1000).unref();
process.on('exit',()=>{clearInterval(sample);flush()});
