import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createGzip } from 'node:zlib';

// Test-only static origin: a separate event loop keeps synthetic PGlite Preview
// work from delaying code chunks, as a CDN would in a deployed app.
const directory = path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT ?? 'outputs/planner-c8-browser');
const failPrefix = process.env.PLANNER_P4B_FAIL_CHUNK_ONCE;
let failed = false;
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/calibration') {
    response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
    response.end(`<!doctype html><html lang="fr"><title>Calibration locale rAF P4B</title><button id="run">Mesurer 12 frames sans Composer</button><output id="result" data-result="{}"></output><script>
      document.getElementById('run').onclick=()=>{const intervals=[];let last=performance.now();function frame(now){intervals.push(now-last);last=now;if(intervals.length<12)requestAnimationFrame(frame);else{const result={intervals,visibility:document.visibilityState,viewport:[innerWidth,innerHeight]};document.getElementById('result').dataset.result=JSON.stringify(result);document.getElementById('result').textContent=JSON.stringify(result);}}requestAnimationFrame(frame);};
    </script></html>`); return;
  }
  if (!/^\/(?:app\.(?:js|css)|chunks\/[a-zA-Z0-9_-]+\.js)$/.test(pathname)) {
    response.writeHead(404); response.end(); return;
  }
  const file = path.join(directory, pathname.slice(1));
  if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  if (!failed && failPrefix && path.basename(file).startsWith(failPrefix)) {
    failed = true; response.writeHead(503, { 'Access-Control-Allow-Origin':'*' }); response.end('Synthetic chunk failure'); return;
  }
  const send = () => {
    const compressed = /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
    response.writeHead(200, { 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-store',
      'Timing-Allow-Origin':'*', ...(compressed ? { 'Content-Encoding':'gzip' } : {}),
      'Content-Type':pathname.endsWith('.css')?'text/css':'application/javascript' });
    const stream = fs.createReadStream(file);
    if (compressed) stream.pipe(createGzip({level:6})).pipe(response); else stream.pipe(response);
  };
  if (process.env.PLANNER_P4B_DELAY_CHUNK && path.basename(file).startsWith(process.env.PLANNER_P4B_DELAY_CHUNK)) {
    setTimeout(send, Math.min(3000, Number(process.env.PLANNER_P4B_CHUNK_DELAY_MS ?? 500)));
  } else send();
});
server.listen(Number(process.env.PORT ?? 3160), '127.0.0.1', () => console.log(`P4B fixture assets ready on 127.0.0.1:${server.address().port}`));
process.on('SIGINT', () => server.close());
