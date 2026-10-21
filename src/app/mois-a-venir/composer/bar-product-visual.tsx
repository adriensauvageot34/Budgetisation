"use client";
import {useState} from "react";
import {Beer,Wine,Martini,GlassWater,Utensils,Cookie,Package,Amphora,Ticket,CarTaxiFront,MapPin,Car,Train,Bus,Footprints} from "lucide-react";
import styles from "./composer.module.css";

/** Existing artwork plus code-native icons. Decoration never invents a product or a price. */
export function BarProductVisual({assetKey,label="",child=false,closed=false,dock=false,compact=false}:{assetKey?:string;label?:string;child?:boolean;closed?:boolean;dock?:boolean;compact?:boolean}){
  const key=assetKey?.split(":").at(-1);
  const [failedImage,setFailedImage]=useState<string|null>(null);
  const image=closed&&key==='cocktail'?'drinks/cocktail-closed':closed&&key==='soft'?'drinks/soft-closed':closed&&key==='tapas'?'food/tapas-closed':closed&&key==='beer'?'drinks/beer-closed':closed&&(key==="shared"||!key&&/bouteille/iu.test(label))?"drinks/shared-bottle-closed":key&&({beer:"drinks/beer",vodka:"drinks/vodka",rum:"drinks/rum",wine:"drinks/wine-glass",soft:"drinks/soft",water:"drinks/water",shot:"drinks/shot",mixer:"drinks/soft",crazy_tiger:"drinks/energy",shared:"drinks/wine-bottle",snack:"food/snack",chips:"food/chips",tapas:"food/tapas",drinks:"drinks/bar-editorial",food:"food/snack",car:"transport/car",train:"transport/train",bus:"transport/bus",free:"transport/walking"} as Record<string,string>)[key];
  const dockImage=dock&&key?({drinks:"r7/family-drinks",food:"food/main",beer:"drinks/beer-closed",wine:"r7/wine",cocktail:"drinks/cocktail-closed",shot:"r7/shot",soft:"drinks/soft-closed",water:"r7/water"} as Record<string,string>)[key]:undefined;
  const compactImage=compact&&key?({beer:'drinks/beer-closed',wine:'r7/wine',cocktail:'drinks/cocktail-closed',soft:'drinks/soft-closed',tapas:'food/tapas-closed'} as Record<string,string>)[key]:undefined;
  // Dedicated transparent objects, shared by closed tiles, editor and Bar dock.
  // Other assets keep their original resources unchanged.
  const objectKey=(key&&({beer:'beer',vodka:'vodka',rum:'rum',wine:'wine',cocktail:'cocktail',soft:'soft',mixer:'soft',water:'water',shot:'shot',crazy_tiger:'energy',shared:'shared',snack:'snack',chips:'chips',tapas:'tapas'} as Record<string,string>)[key])
    ??(!key&&/bouteille/iu.test(label)?'shared':undefined);
  const source=objectKey?`bar-compact/${objectKey}`:key==='taxi'?'transport/taxi-r8':key==='home'?'home/house-r8':dockImage??compactImage??image;
  const Icon=child?Ticket:key==="car"?Car:key==="train"?Train:key==="bus"?Bus:key==="free"?Footprints:key==="taxi"?CarTaxiFront:key==="place"?MapPin:key==="cocktail"?Martini:key==="tapas"||key==="food"?Utensils:key==="snack"||key==="chips"?Cookie:key==="beer"||key==="drinks"?Beer:key==="wine"?Wine:key==="soft"||key==="water"?GlassWater:/bouteille/iu.test(label)?Amphora:Package;
  const showImage=source&&failedImage!==source;
  return <span className={styles.barProductSymbol} data-bar-visual={showImage?"clay":"functional-icon"} data-object-art={!!objectKey||undefined} data-panoramic-art={dock&&!objectKey&&!!source&&!source.startsWith("r7/")||undefined} aria-hidden="true">{showImage?<img src={`/planned-visuals/builder/clay/${source}.${source?.endsWith('-r8')?'png':'webp'}`} alt="" width={48} height={40} draggable={false} onError={()=>setFailedImage(source)}/>:<Icon size={30} strokeWidth={1.7}/>}</span>;
}
