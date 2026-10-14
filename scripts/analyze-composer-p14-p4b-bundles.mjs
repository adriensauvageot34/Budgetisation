import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const variants=[];
for (const directory of process.argv.slice(2)) {
  const meta = JSON.parse(fs.readFileSync(path.join(directory, 'bundle-meta.json'), 'utf8'));
  const outputs = Object.entries(meta.outputs).filter(([name]) => name.endsWith('.js'));
  const byName = new Map(outputs);
  const initial = new Set();
  function visit(name) {
    if (initial.has(name)) return;
    initial.add(name);
    for (const item of byName.get(name)?.imports ?? []) if (item.kind !== 'dynamic-import' && byName.has(item.path)) visit(item.path);
  }
  const entry = outputs.find(([name]) => path.basename(name) === 'app.js')?.[0];
  if (!entry) throw Error(`Missing entry: ${directory}`);
  visit(entry);
  const files = outputs.map(([name, details]) => {
    const data = fs.readFileSync(path.resolve(name));
    return { file:path.relative(directory,name).replaceAll('\\','/'), bytes:data.length, gzip:gzipSync(data,{level:9}).length,
      initial:initial.has(name), imports:details.imports.filter(item => item.kind === 'dynamic-import').map(item => path.basename(item.path)) };
  }).sort((a,b)=>a.file.localeCompare(b.file));
  const sum = (subset, field) => subset.reduce((total,file)=>total+file[field],0);
  const first = files.filter(file=>file.initial);
  variants.push({directory, initial:{files:first.length,bytes:sum(first,'bytes'),gzip:sum(first,'gzip')},
    all:{files:files.length,bytes:sum(files,'bytes'),gzip:sum(files,'gzip')}, files});
}
console.log(JSON.stringify(variants,null,2));
