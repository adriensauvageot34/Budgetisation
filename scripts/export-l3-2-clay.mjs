import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),sharp=require(process.env.L2B_SHARP_MODULE??'sharp');
const evidence='docs/status/evidence/l3-2-composer-library',dir='public/planned-visuals/composer/presets',originalDir='outputs/l3-2-clay-originals';
const sources=JSON.parse(await readFile(evidence+'/generation-sources.json','utf8')),manifest=[];
if(sources.length!==21||new Set(sources.map(s=>s.presetKey)).size!==21)throw Error('Expected 21 individual creations');
await mkdir(evidence+'/prompts',{recursive:true});await mkdir(originalDir,{recursive:true});
for(const source of sources){
 const sourcePath='C:/Users/AdrienSauvageot/.codex/generated_images/01a121f4-d422-7500-acfb-6d5229d32d5b/'+source.originalFile;
 const native=await readFile(sourcePath),metadata=await sharp(native).metadata();
 if(metadata.width/metadata.height!==2)throw Error('Non 2:1 original '+source.presetKey);
 const file=dir+'/'+source.presetKey+'.webp';
 await sharp(native).resize(1200,600,{fit:'inside'}).webp({quality:82}).toFile(file);
 await copyFile(sourcePath,originalDir+'/'+source.presetKey+'.png');
 const bytes=await readFile(file);await writeFile(evidence+'/prompts/'+source.presetKey+'.txt',source.prompt+'\n');
 manifest.push({presetKey:source.presetKey,file,width:1200,height:600,quality:82,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
 originalFile:source.originalFile,originalLocalCopy:originalDir+'/'+source.presetKey+'.png',originalSha256:createHash('sha256').update(native).digest('hex'),originalWidth:metadata.width,originalHeight:metadata.height,
 generator:'built-in image_gen',generations:source.generations,prompt:'prompts/'+source.presetKey+'.txt',inspection:source.inspection,selected:true});
}
await writeFile(evidence+'/illustrations.json',JSON.stringify(manifest,null,2)+'\n');
const inputs=await Promise.all(manifest.map(async(m,i)=>({input:await sharp(m.file).resize(300,150).toBuffer(),left:(i%3)*300,top:Math.floor(i/3)*150})));
await sharp({create:{width:900,height:1050,channels:3,background:'#f7f1e9'}}).composite(inputs).jpeg({quality:88}).toFile(evidence+'/clay-gallery.jpg');
console.log(JSON.stringify({count:manifest.length,bytes:manifest.reduce((n,m)=>n+m.bytes,0),originalsRetained:originalDir}));
