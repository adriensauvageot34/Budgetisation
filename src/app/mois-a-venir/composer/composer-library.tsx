import { useState, useRef, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { useComposerInteractions } from "./interactions";

// These aliases only order and name existing server groups. They admit no assets.
const groupOrder = ["SOCIAL", "FOOD", "ACTIVITY", "PURCHASE", "BEAUTY", "VISIT", "TRAVEL", "HOME", "OTHER", "controls", "options"];
const groupName = (key: string, label: string) => key === "controls" ? "Habitudes & cagnottes" : key === "options" ? "Équipements" : label;
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
export function ComposerLibrary({ model, openToken, busy, selected, choose, drag }: { model: ComposerUiModel; openToken: number; busy: boolean; selected: string | null;
  choose: (asset: ComposerAssetView) => void; drag: (key: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [activeAsset, setActiveAsset] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null), interaction = useComposerInteractions();
  useEffect(() => { if (openToken > 0) { setQuery(""); search.current?.focus(); } }, [openToken]);
  useEffect(() => {
    const quickFind = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],dialog[open]")) return;
      event.preventDefault(); search.current?.focus();
    };
    window.addEventListener("keydown", quickFind); return () => window.removeEventListener("keydown", quickFind);
  }, []);
  const groups = useMemo(() => model.library.sections.toSorted((a, b) => groupOrder.indexOf(a.sectionKey) - groupOrder.indexOf(b.sectionKey)).map(section => ({
    ...section, label: groupName(section.sectionKey, model.sectionLabels[section.sectionKey] ?? section.sectionKey),
    assets: model.library.searchableAssets.filter(a => section.assetKeys.includes(a.assetKey) && normalize(`${a.label} ${groupName(section.sectionKey, model.sectionLabels[section.sectionKey] ?? "")}`).includes(normalize(query)))
  })).filter(group => group.assets.length), [model.library, model.sectionLabels, query]);
  const activeKey = groups.some(group => group.assets.some(asset => asset.assetKey === activeAsset)) ? activeAsset : groups[0]?.assets[0]?.assetKey;
  return <aside className={styles.library} data-library aria-label="Bibliothèque d’intentions">
    <header className={styles.panelHeader}><h2><button className={styles.libraryOpen} data-library-open onClick={() => search.current?.focus()}>Ajouter à mon mois</button></h2></header>
    <label className={styles.search} title="Rechercher dans la bibliothèque (/)" ><Search size={15} aria-hidden="true" />
      <input ref={search} data-library-search aria-label="Rechercher une intention" value={query} onChange={e => setQuery(e.target.value)} placeholder="Une idée en tête ?"
        onKeyDown={e => { if (e.key === "Enter" && query && groups[0]?.assets[0] && !busy) { e.preventDefault(); choose(groups[0].assets[0]); } }} /></label>
    <div className={styles.libraryScroll}>{groups.map(section => <section key={section.sectionKey} className={styles.assetGroup} data-library-group>
      <h3>{section.label}</h3><div className={styles.assetGrid}>{section.assets.map(asset => {
        const source = model.presentation.dragSources[asset.assetKey];
        const draggable = (!!source?.editorDropTarget || model.dropCapabilities.some(d => d.sourceAssetKey === asset.assetKey && d.resolution !== "BLOCKED")) && asset.provenance !== "DERIVED_CONSEQUENCE";
        return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} data-selected={selected === asset.assetKey} disabled={busy}
          title={`${asset.label}${source?.editorTargetRef ? " · choisir une allocation" : ""} · parcourir avec les flèches`}
          tabIndex={activeKey === asset.assetKey ? 0 : -1} onFocus={() => setActiveAsset(asset.assetKey)}
          onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return; e.preventDefault();
            const assets = Array.from(e.currentTarget.closest("aside")!.querySelectorAll<HTMLButtonElement>("[data-asset]")), index = assets.indexOf(e.currentTarget);
            const next = e.key === "Home" ? 0 : e.key === "End" ? assets.length - 1 : index + (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -2 : 2);
            assets[Math.max(0, Math.min(assets.length - 1, next))]?.focus(); }}
          draggable={draggable && !busy} data-drag-source={asset.assetKey} data-grabbed={interaction?.grabbed?.sourceKey === asset.assetKey}
          onDragStart={e => { if (interaction) interaction.start(asset.assetKey, e); else { e.dataTransfer.setData("application/x-planner-asset", asset.assetKey); drag(asset.assetKey); } }}
          onDragEnd={() => { interaction?.end(); drag(null); }} onClick={() => choose(asset)}>
          <PlannerIcon iconKey={asset.iconKey} identityRef={asset.capabilityRef} scale="LIBRARY" className={styles.assetIcon} /><span>{asset.label}</span>
        </button>;
      })}</div></section>)}{!groups.length && <p className={styles.searchEmpty}>Aucun élément trouvé.</p>}</div>
  </aside>;
}
