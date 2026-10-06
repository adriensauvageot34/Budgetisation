import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { require } from './lib/phase2-ts-loader.mjs';
import { createKernelPostgres } from './lib/planner-kernel-postgres.mjs';
import { simpleMonth, nightMonth, weekendMonth, renewalMonth, externalMonth, householdId } from './fixtures/planner-headless.mjs';
import { providers } from './fixtures/planner-mobility.mjs';
import { atomicMonth, interactionMonth } from './fixtures/planner-atomic-ui.mjs';
const { handleComposerRequest } = require('@/server/phase2/planner/composer-service');
const { createPlanApplyRepository } = require('@/server/phase2/planner/repository');
const { preparePlanningMobility } = require('@/server/phase2/planner/prospective-mobility-pricing');
// Every prospective provider is synthetic. Reject any accidental server network call.
globalThis.fetch = async () => { throw new Error('FIXTURE_NETWORK_FORBIDDEN'); };
const { build } = await import(process.env.PLANNER_BROWSER_TOOLS ? pathToFileURL(path.join(process.env.PLANNER_BROWSER_TOOLS, 'node_modules/esbuild/lib/main.js')).href : 'esbuild');
const out = path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT ?? 'outputs/planner-c8-browser');
fs.mkdirSync(out, { recursive: true });
const mocks = {
  'next/link': 'import React from "react"; export default function Link({children,...props}) { return React.createElement("a",props,children); }',
  'next/navigation': 'export const usePathname = () => "/mois-a-venir/composer";',
  '@/components/runtime': 'import {useRef} from "react"; export function useProductRuntime(){return {backgroundRootRef:useRef(null)}}',
  '@/features/auth/sign-out-button': 'import React from "react"; export const SignOutButton = () => React.createElement("button",{disabled:true},"Déconnexion");'
};
await build({ entryPoints: ['scripts/lib/planner-composer-browser-entry.tsx'], bundle: true, format: 'esm', target: 'chrome120', jsx: 'automatic',
  outfile: path.join(out, 'app.js'), loader: { '.css': 'local-css' }, sourcemap: true,
  external: ['/planned-visuals/*'],
  plugins: [{name:'fixture-host-only',setup(builder){ builder.onResolve({filter:/^(next\/link|next\/navigation|@\/components\/runtime|@\/features\/auth\/sign-out-button)$/},args=>({path:args.path,namespace:'fixture-host'}));
    builder.onLoad({filter:/.*/,namespace:'fixture-host'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()})); }}] });
const globalCss = fs.readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(`.next/static/chunks/${n}`,'utf8')).find(css=>css.includes('.h-dvh{'));
if (!globalCss) throw new Error('Build Next.js first: production globals containing h-dvh are required for actual AppShell height checks.');
fs.writeFileSync(path.join(out,'global.css'),globalCss);
const stores = new Map(), fixtures = { A: simpleMonth, B: nightMonth, C: weekendMonth, D: renewalMonth, E: externalMonth, R: atomicMonth,
  RA: interactionMonth, RB: nightMonth, RC: weekendMonth, RR: atomicMonth };
const uiPayloadKeys = new Set(['x','y','screenX','screenY','uiPosition','boardPosition','orbit','presentation','focusedContext']);
function uiPayloadFields(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [...(uiPayloadKeys.has(key) ? [key] : []), ...uiPayloadFields(child)]);
}
async function store(key) {
  if (!stores.has(key)) stores.set(key, (async () => {
    const pg = await createKernelPostgres(), fixture = (fixtures[key] ?? fixtures.A)(), owner = providers();
    return { pg, fixture, log: [], deps: { repository: createPlanApplyRepository(pg.client), readWorld: async () => fixture.world,
      prepareWorld: (world, state) => preparePlanningMobility(world, state, owner.value) } };
  })());
  return stores.get(key);
}
const host = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Composer mon mois — fixtures C8</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`;
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1'), key = url.searchParams.get('scenario') ?? 'A';
    if (url.pathname === '/interaction') {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const command = JSON.parse(Buffer.concat(chunks).toString()), s = await store(key);
      if (command.kind === 'READ' && !command.draft && !(await s.deps.repository.readActivePlan(householdId, '2026-11'))?.activeRevision) command.draft = s.fixture.semantic;
      // Delays only in this isolated host, to exercise stale hover responses in the actual UI.
      const result = await handleComposerRequest(s.deps, householdId, command);
      await s.pg.verifyCanaries();
      s.log.push({ kind: command.kind, sequence: command.sequence, mutationKind: result.mutationKind ?? null,
        gesture: command.kind === 'DROP' ? {assetKey:command.assetKey,target:command.target,sourceSocket:command.sourceSocket??null} : null,
        interactionImpact: result.interactionImpact ?? null,
        uiPayloadFields: uiPayloadFields(command),
        ok: result.ok, digest: result.ok ? result.model.board.draft.semanticStateDigest : result.code,
        projection: result.ok ? result.model.board.cockpit : null });
      if (url.searchParams.get('delayHover') === 'true' && command.kind === 'MUTATE' || url.searchParams.get('delayDrop') === 'true' && command.kind === 'DROP') await new Promise(resolve => setTimeout(resolve, 800));
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(result)); return;
    }
    if (url.pathname === '/evidence') {
      const s = await store(key); await s.pg.verifyCanaries(); response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ counts: await s.pg.counts(), rpcCalls: s.pg.rpcCalls, remoteWrites: 0, historicalCanaryWrites: 0, log: s.log,
        active: await s.deps.repository.readActivePlan(householdId, '2026-11') })); return;
    }
    if (['/app.js', '/app.css', '/global.css', '/app.js.map', '/app.css.map'].includes(url.pathname)) {
      response.setHeader('Content-Type', url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript'); response.end(fs.readFileSync(path.join(out, url.pathname.slice(1)))); return;
    }
    response.setHeader('Content-Type', 'text/html'); response.end(host);
  } catch (error) { console.error(error.message); response.writeHead(500); response.end('Fixture failed'); }
});
await store('A');
server.listen(Number(process.env.PORT ?? 3108), '127.0.0.1', () => console.log(`C8 synthetic Composer ready http://127.0.0.1:${server.address().port} (no remote writes)`));
process.on('SIGINT', async () => { server.close(); for (const promise of stores.values()) await (await promise).pg.close(); process.exit(); });
