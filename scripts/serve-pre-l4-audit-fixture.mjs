// Audit-only launcher. Product modules and the production bundle are unchanged.
// Optional a0Confirm=decline|accept stubs ONLY native confirm on synthetic data.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const original=fs.readFileSync('scripts/serve-phase2-planner-composer-fixture.mjs','utf8');
const probe=`<script>if(new URLSearchParams(location.search).has('a0Confirm')){const mode=new URLSearchParams(location.search).get('a0Confirm');document.body.dataset.a0ConfirmationMode=mode;window.confirm=function(){document.body.dataset.a0ConfirmationCalls=String(Number(document.body.dataset.a0ConfirmationCalls||0)+1);return mode==='accept';};}</script>`;
const line="const documentHost = url.searchParams.get('l31Trace') === '1' ? host.replace('</body>', l31DragTrace + '</body>') : host;";
if(!original.includes(line))throw Error('AUDIT_FIXTURE_INSERTION_CHANGED');
let source=original.replace(line,`const documentHost = (url.searchParams.get('l31Trace') === '1' ? host.replace('</body>', l31DragTrace + '</body>') : host).replace('</body>',${JSON.stringify(probe)}+'</body>');`);
source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${pathToFileURL(path.resolve('scripts',p)).href}'`);
fs.mkdirSync('outputs/pre-l4-audit',{recursive:true});
const generated=path.resolve('outputs/pre-l4-audit/server.mjs');
fs.writeFileSync(generated,source);
await import(pathToFileURL(generated).href);
