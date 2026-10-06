import { useState } from "react";
import { Search, GripVertical, Plus, Shapes } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
export function ComposerLibrary({ model, busy, selected, choose, drag }: { model: ComposerUiModel; busy: boolean; selected: string | null;
  choose: (asset: ComposerAssetView) => void; drag: (key: string | null) => void }) {
  const [query, setQuery] = useState(""), [tab, setTab] = useState("contexts");
  return <aside className={styles.library} aria-label="Bibliothèque d’intentions"><header className={styles.panelHeader}><Shapes size={19} /><h2>À composer</h2></header>
    <p className={styles.helper}>Une envie, un moment, un projet.<br />Glissez ou choisissez une carte.</p>
    <label className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label="Rechercher une intention" value={query} onChange={e => setQuery(e.target.value)} placeholder="Une idée en tête ?" /></label>
    <div className={styles.tabs} role="group" aria-label="Types de cartes">{[["contexts", "Situations"], ["options", "Composants"], ["controls", "Leviers"]].map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div className={styles.libraryScroll}>{model.library.sections.filter(s => tab === "contexts" ? !["options", "controls"].includes(s.sectionKey) : s.sectionKey === tab).map(section => {
      const assets = model.library.searchableAssets.filter(a => section.assetKeys.includes(a.assetKey) && a.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
      return assets.length ? <section key={section.sectionKey} className={styles.assetGroup}><h3>{model.sectionLabels[section.sectionKey]}</h3>{assets.map(asset => {
        const draggable = model.dropCapabilities.some(d => d.sourceAssetKey === asset.assetKey && d.resolution !== "BLOCKED") && asset.provenance !== "DERIVED_CONSEQUENCE";
        return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} data-selected={selected === asset.assetKey} disabled={busy}
          draggable={draggable && !busy} onDragStart={e => { e.dataTransfer.setData("application/x-planner-asset", asset.assetKey); e.dataTransfer.effectAllowed = "move"; drag(asset.assetKey); }} onDragEnd={() => drag(null)}
          onClick={() => choose(asset)}><span className={styles.assetIcon} aria-hidden="true">{draggable ? <GripVertical size={17} /> : <Shapes size={17} />}</span><span>{asset.label}<small>{asset.kind === "SLOT_OPTION_ASSET" ? "À placer dans un emplacement" : asset.kind === "CONTEXT_ASSET" ? "Composer ce moment" : "Retrouver sur le mois"}</small></span><Plus size={14} aria-hidden="true" /></button>;
      })}</section> : null;
    })}</div><footer className={styles.libraryFooter}>Vos habitudes restent des repères.<br />Vous choisissez la suite.</footer>
  </aside>;
}
