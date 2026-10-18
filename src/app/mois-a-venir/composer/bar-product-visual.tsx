"use client";
import {Beer,Wine,Martini,GlassWater,Utensils,Cookie,Package,Amphora,Ticket} from "lucide-react";
import styles from "./composer.module.css";

/** Existing artwork plus code-native icons. Decoration never invents a product or a price. */
export function BarProductVisual({assetKey,label="",child=false}:{assetKey?:string;label?:string;child?:boolean}){
  const key=assetKey?.split(":").at(-1);
  const image=key&&({beer:"beer",vodka:"vodka",rum:"rum",wine:"wine-glass",soft:"soft",water:"water",shot:"shot",mixer:"soft",crazy_tiger:"energy"} as Record<string,string>)[key];
  const Icon=child?Ticket:key==="cocktail"?Martini:key==="tapas"?Utensils:key==="snack"||key==="chips"?Cookie:key==="beer"?Beer:key==="wine"?Wine:key==="soft"||key==="water"?GlassWater:/bouteille/iu.test(label)?Amphora:Package;
  return <span className={styles.barProductSymbol} aria-hidden="true">{image?<img src={`/planned-visuals/builder/clay/drinks/${image}.webp`} alt="" width={40} height={40}/>:<Icon size={30} strokeWidth={1.6}/>}</span>;
}
