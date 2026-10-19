"use client";
import {Beer,Wine,Martini,GlassWater,Utensils,Cookie,Package,Amphora,Ticket,CarTaxiFront,MapPin} from "lucide-react";
import styles from "./composer.module.css";

/** Existing artwork plus code-native icons. Decoration never invents a product or a price. */
export function BarProductVisual({assetKey,label="",child=false}:{assetKey?:string;label?:string;child?:boolean}){
  const key=assetKey?.split(":").at(-1);
  const image=key&&({beer:"drinks/beer",vodka:"drinks/vodka",rum:"drinks/rum",wine:"drinks/wine-glass",soft:"drinks/soft",water:"drinks/water",shot:"drinks/shot",mixer:"drinks/soft",crazy_tiger:"drinks/energy",shared:"drinks/wine-bottle",snack:"food/snack",chips:"food/chips",tapas:"food/tapas",drinks:"drinks/bar-editorial",food:"food/snack",car:"transport/car",train:"transport/train",bus:"transport/bus",free:"transport/walking"} as Record<string,string>)[key];
  const Icon=child?Ticket:key==="taxi"?CarTaxiFront:key==="place"?MapPin:key==="cocktail"?Martini:key==="tapas"?Utensils:key==="snack"||key==="chips"?Cookie:key==="beer"?Beer:key==="wine"?Wine:key==="soft"||key==="water"?GlassWater:/bouteille/iu.test(label)?Amphora:Package;
  return <span className={styles.barProductSymbol} data-bar-visual={image?"clay":"functional-icon"} aria-hidden="true">{image?<img src={`/planned-visuals/builder/clay/${image}.webp`} alt="" width={48} height={40}/>:<Icon size={30} strokeWidth={1.7}/>}</span>;
}
