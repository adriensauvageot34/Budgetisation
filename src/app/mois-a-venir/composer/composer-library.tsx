import { useState, useRef, useEffect } from "react";
import { Search, GripVertical } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { useComposerInteractions } from "./interactions";
export function ComposerLibrary({ model, openToken, busy, selected, choose, drag }: { model: ComposerUiModel; openToken: number; busy: boolean; selected: string | null;
  choose: (asset: ComposerAssetView) => void; drag: (key: string | null) => void }) {
  const [query, setQuery] = useState(""), [tab, setTab] = useState("contexts");
  const search = useRef<HTMLInputElement>(null);
  const interaction = useComposerInteractions();
  useEffect(() => { if (openToken > 0) { setQuery(""); setTab("contexts"); search.current?.focus(); } }, [openToken]);
  return <aside className={styles.library} aria-label="Bibliothèque d’intentions"><header className={styles.panelHeader}><h2>Ajouter à mon mois</h2></header>
    <p className={styles.helper}>Un objet, une envie, un moment.<br />Glissez ou choisissez.</p>
    <label className={styles.search}><Search size={16} aria-hidden="true" /><input ref={search} aria-label="Rechercher une intention" value={query} onChange={e => setQuery(e.target.value)} placeholder="Une idée en tête ?" /></label>
    <div className={styles.tabs} role="group" aria-label="Types de cartes">{[["contexts", "Situations"], ["options", "Composants"], ["controls", "Leviers"]].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div className={styles.libraryScroll}>{model.library.sections.filter(s => tab === "contexts" ? !["options", "controls"].includes(s.sectionKey) : s.sectionKey === tab).map(section => {
      const assets = model.library.searchableAssets.filter(a => section.assetKeys.includes(a.assetKey) && a.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
      return assets.length ? <section key={section.sectionKey} className={styles.assetGroup}><h3>{model.sectionLabels[section.sectionKey]}</h3>{assets.map(asset => {
        const draggable = model.dropCapabilities.some(d => d.sourceAssetKey === asset.assetKey && d.resolution !== "BLOCKED") && asset.provenance !== "DERIVED_CONSEQUENCE";
        return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} data-selected={selected === asset.assetKey} disabled={busy}
          draggable={draggable && !busy} data-drag-source={asset.assetKey} data-grabbed={interaction?.grabbed?.sourceKey === asset.assetKey} onDragStart={e => { if (interaction) interaction.start(asset.assetKey, e); else { e.dataTransfer.setData("application/x-planner-asset", asset.assetKey); drag(asset.assetKey); } }} onDragEnd={() => { interaction?.end(); drag(null); }}
          onClick={() => choose(asset)}><PlannerIcon iconKey={asset.iconKey} scale="PALETTE" className={styles.assetIcon} /><span>{asset.label}<small>{asset.kind === "SLOT_OPTION_ASSET" ? "À placer dans un emplacement" : asset.kind === "CONTEXT_ASSET" ? "Composer ce moment" : "Retrouver sur le mois"}</small></span>{draggable && <GripVertical size={14} className={styles.assetGrip} aria-hidden="true" />}</button>;
      })}</section> : null;
    })}</div><footer className={styles.libraryFooter}>Vos habitudes restent des repères.<br />Vous choisissez la suite.</footer>
  </aside>;
}
