import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const base='7765bc532511d777ef3e3c80ff0b48826a4e465e';
const files=execFileSync('git',['diff','--name-only',base,'--','src'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const originalRead=fs.readFileSync, replacements=new Map(files.map(file=>[path.resolve(file),execFileSync('git',['show',`${base}:${file}`])]));
// Only the TS test loader's source reads change. No checkout mutation, no service credentials.
fs.readFileSync=function(file,options){const replacement=typeof file==='string'?replacements.get(path.resolve(file)):null;
  if(!replacement)return originalRead.call(this,file,options);return typeof options==='string'||options?.encoding ? replacement.toString(typeof options==='string'?options:options.encoding) : replacement;};
console.log(`P09 baseline source ${base}: ${replacements.size} source files restored in-memory`);
await import('./check-phase2-planner-p09.mjs');
