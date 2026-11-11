import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const [repo,campaign]=process.argv.slice(2),sharp=createRequire(import.meta.url)('C:/Users/AdrienSauvageot/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const json=async p=>JSON.parse(await readFile(p)),hash=b=>createHash('sha256').update(b).digest('hex');
const report=path.join(campaign,'work/clay-campaign/m15/M15-TECHNICAL-DERIVATIVES.json'),derivatives=await json(report);
const geometries=await json(path.join(campaign,'work/clay-campaign/m12-art-review/M12-GEOMETRIE-EXPORTS.json'));
const collectionFile=path.join(repo,'public/planned-visuals/builder/clay/v22/collection.json'),collection=await json(collectionFile);
const mappingFile=path.join(campaign,'work/clay-campaign/m15/M14-2-MAPPING.json'),mapping=await json(mappingFile);
for(const row of derivatives.derivatives){
 const geom=geometries.formats.find(g=>g.id===row.visualConceptId);assert.equal(geom.sourceSha256,row.sourceSHA256);
 const adaptation=geom.targets.find(t=>t.size[0]===256&&t.size[1]===256).adaptation;
 const input=await readFile(path.join(campaign,'outputs/m13',row.sourcePath));assert.equal(hash(input),row.sourceSHA256);
 const layer=await sharp(input).extract(adaptation.sourceBoundsAlpha5).resize(218,218,{fit:'inside'}).png().toBuffer();
 const meta=await sharp(layer).metadata();assert.deepEqual([meta.width,meta.height],[adaptation.placed.width,adaptation.placed.height]);
 const png=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:layer,left:adaptation.placed.x,top:adaptation.placed.y}]).png().toBuffer();
 const webp=await sharp(png).webp({quality:95,alphaQuality:100,effort:5}).toBuffer();
 row.export.bytes=webp.length;row.export.sha256=hash(webp);row.geometry={sourceBoundsAlpha5:adaptation.sourceBoundsAlpha5,placed:adaptation.placed,fit:'UNIFORM_SUBJECT_WITH_TRANSPARENT_PADDING'};
 row.reason='Groupe complet recentré selon la géométrie M12, avec la bonne source finale M13. Réduit les marges vides dans les petites palettes.';
 await writeFile(path.join(repo,'public/planned-visuals/builder/clay/v22',row.export.path),webp);
 for(const data of [collection.entries,mapping.illustrations])data.find(m=>m.visualConceptId===row.visualConceptId).roles.compact={...row.export};
}
await writeFile(report,JSON.stringify(derivatives,null,2)+'\n');
await writeFile(collectionFile,JSON.stringify(collection)+'\n');
await writeFile(mappingFile,JSON.stringify(mapping,null,2)+'\n');
console.log(JSON.stringify({refined:derivatives.derivatives.length,miniatureBytes:derivatives.derivatives.reduce((n,r)=>n+r.export.bytes,0)}));
