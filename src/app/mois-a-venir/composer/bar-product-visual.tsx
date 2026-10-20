"use client";
import {useState} from "react";
import {Beer,Wine,Martini,GlassWater,Utensils,Cookie,Package,Amphora,Ticket,CarTaxiFront,MapPin,Car,Train,Bus,Footprints} from "lucide-react";
import styles from "./composer.module.css";

/** Existing artwork plus code-native icons. Decoration never invents a product or a price. */
export function BarProductVisual({assetKey,label="",child=false,closed=false}:{assetKey?:string;label?:string;child?:boolean;closed?:boolean}){
  const key=assetKey?.split(":").at(-1);
  const [failedImage,setFailedImage]=useState<string|null>(null);
  const image=closed&&key==='cocktail'?'intent/party':closed&&key==='beer'?'drinks/beer-closed':closed&&(key==="shared"||!key&&/bouteille/iu.test(label))?"drinks/shared-bottle-closed":key&&({beer:"drinks/beer",vodka:"drinks/vodka",rum:"drinks/rum",wine:"drinks/wine-glass",soft:"drinks/soft",water:"drinks/water",shot:"drinks/shot",mixer:"drinks/soft",crazy_tiger:"drinks/energy",shared:"drinks/wine-bottle",snack:"food/snack",chips:"food/chips",tapas:"food/tapas",drinks:"drinks/bar-editorial",food:"food/snack",car:"transport/car",train:"transport/train",bus:"transport/bus",free:"transport/walking"} as Record<string,string>)[key];
  const Icon=child?Ticket:key==="car"?Car:key==="train"?Train:key==="bus"?Bus:key==="free"?Footprints:key==="taxi"?CarTaxiFront:key==="place"?MapPin:key==="cocktail"?Martini:key==="tapas"||key==="food"?Utensils:key==="snack"||key==="chips"?Cookie:key==="beer"||key==="drinks"?Beer:key==="wine"?Wine:key==="soft"||key==="water"?GlassWater:/bouteille/iu.test(label)?Amphora:Package;
  const showImage=image&&failedImage!==image;
  return <span className={styles.barProductSymbol} data-bar-visual={showImage?"clay":"functional-icon"} aria-hidden="true">{showImage?<img src={`/planned-visuals/builder/clay/${image}.webp`} alt="" width={48} height={40} onError={()=>setFailedImage(image)}/>:<Icon size={30} strokeWidth={1.7}/>}</span>;
}
