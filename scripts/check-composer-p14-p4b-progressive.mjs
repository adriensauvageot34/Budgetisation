import assert from 'node:assert/strict';
import Module from 'node:module';
import { require } from './lib/phase2-ts-loader.mjs';
import { state } from './fixtures/planner-headless.mjs';

globalThis.fetch = async () => { throw Error('P4B_PREFETCH_NETWORK_FORBIDDEN'); };
const { editorChunks, editorChunkForAsset, preloadEditorForAsset } = require('@/app/mois-a-venir/composer/editor-chunks');
const { semanticStateDigest } = require('@/domain/phase2/planner/semantic-state');
const draft = state(), before = JSON.stringify(draft), digest = semanticStateDigest(draft);
const asset = templateKey => ({ kind:'CONTEXT_ASSET', templateKey });
assert.equal(editorChunkForAsset(asset('night-out')), null);
assert.equal(editorChunkForAsset({ kind:'SLOT_OPTION_ASSET', optionKind:'MOBILITY_INTENT' }), null);
assert.equal(editorChunkForAsset(asset('family-visit')), 'family');
assert.equal(editorChunkForAsset(asset('short-stay')), 'stay');
assert.equal(editorChunkForAsset(asset('gift')), 'gift');
assert.equal(editorChunkForAsset(asset('restaurant')), 'catalog');
console.log('P4B_CODE_ONLY_INTENT PASS');

const first = editorChunks.family();
assert.equal(first, editorChunks.family());
preloadEditorForAsset(asset('family-visit'));
assert.equal(typeof await first, 'function');
assert.equal(first, editorChunks.family());
console.log('P4B_INFLIGHT_AND_FULFILLED_DEDUP PASS');

const originalLoad = Module._load;
let failed = false;
Module._load = function(name, ...args) {
  if (!failed && /(?:^|\/)gift-editor$/.test(name)) { failed = true; throw Error('P4B_SYNTHETIC_IMPORT_FAILURE'); }
  return originalLoad.call(this, name, ...args);
};
try {
  const rejected = editorChunks.gift();
  await assert.rejects(rejected, /P4B_SYNTHETIC_IMPORT_FAILURE/);
  const retry = editorChunks.gift();
  assert.notEqual(retry, rejected);
  assert.equal(typeof await retry, 'function');
  console.log('P4B_IMPORT_RETRY_WITHOUT_DRAFT_MUTATION PASS');
} finally { Module._load = originalLoad; }

assert.equal(typeof await editorChunks.stay(), 'function');
assert.equal(typeof await editorChunks.catalog(), 'function');
assert.equal(JSON.stringify(draft), before);
assert.equal(semanticStateDigest(draft), digest);
console.log('P4B_COMPLETE_MODULE_EXPORTS_AND_SEMANTIC_PARITY PASS');
console.log('PASS: code imports only; no World, Finance V2, Mobility or durable writer invoked. Browser chunk retry tested separately.');
