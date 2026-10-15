import { memo, useState, useRef, useEffect, useMemo } from "react";
import { COMPOSER_PRESETS, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { PresetIllustration } from "./preset-illustration";
import { Search } from "lucide-react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import styles from "./composer.module.css";
import { PlannerIcon } from "./planner-icons/planner-icon";
import { useComposerInteractions } from "./interactions";
import { composerRenderIndex } from "./render-index";
import { preloadEditorForAsset, preloadEditorForPreset } from "./editor-chunks";

// These aliases only order and name existing server groups. They admit no assets.
const groupOrder = ["SOCIAL", "FOOD", "ACTIVITY", "PURCHASE", "BEAUTY", "VISIT", "TRAVEL", "HOME", "OTHER", "controls", "options"];
const groupName = (key: string, label: string) => key === "controls" ? "Habitudes & cagnottes" : key === "options" ? "Équipements" : label;
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
export const ComposerLibrary=memo(ComposerLibraryView);
function ComposerLibraryView({ model, openToken, busy, selected, choose, choosePreset, drag }: { model: ComposerUiModel; openToken: number; busy: boolean; selected: string | null;
  choose: (asset: ComposerAssetView) => void; choosePreset: (asset: ComposerAssetView, key: ComposerPresetKey) => void; drag: (key: string | null) => void }) {
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(["SOCIAL"]));
  const [activeAsset, setActiveAsset] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null), hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null), interaction = useComposerInteractions();
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  useEffect(() => { if (openToken > 0) { setQuery(""); search.current?.focus(); } }, [openToken]);
  useEffect(() => {
    const quickFind = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true],dialog[open]")) return;
      event.preventDefault(); search.current?.focus();
    };
    window.addEventListener("keydown", quickFind); return () => window.removeEventListener("keydown", quickFind);
  }, []);
  const groups = useMemo(() => {
    const assets = composerRenderIndex(model).assets, term = normalize(query.trim());
    return model.library.sections.toSorted((a, b) => {
      const rank = (key: string) => groupOrder.includes(key) ? groupOrder.indexOf(key) : groupOrder.length;
      return rank(a.sectionKey) - rank(b.sectionKey);
    }).map(section => {
      const label = groupName(section.sectionKey, model.sectionLabels[section.sectionKey] ?? section.sectionKey);
      const matches = section.assetKeys.map(key => assets.get(key)).filter((asset): asset is ComposerAssetView => !!asset)
        .filter(asset => !term || normalize(`${asset.label} ${label}`).includes(term));
      return { ...section, label, matches, total: section.assetKeys.length };
    }).filter(group => group.matches.length);
  }, [model, query]);
  const presets = COMPOSER_PRESETS.flatMap(preset => {
    const asset = model.library.searchableAssets.find(a => a.kind === "CONTEXT_ASSET" && a.templateKey === preset.templateKey);
    const admitted = asset && model.dropCapabilities.some(d => d.sourceAssetKey === asset.assetKey && d.target.kind === "BOARD_ZONE" && d.resolution !== "BLOCKED");
    return asset && admitted && (!query.trim() || normalize([preset.label, ...preset.searchTerms].join(" ")).includes(normalize(query.trim()))) ? [{ preset, asset }] : [];
  });
  const visibleGroups = groups.map(group => ({ ...group, expanded: !!query.trim() || opened.has(group.sectionKey) }));
  const visibleAssets = visibleGroups.flatMap(group => group.expanded ? group.matches : []);
  const toggleGroup = (key: string) => setOpened(current => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  return <aside className={styles.library} data-library aria-label="Bibliothèque d’intentions">
    <header className={styles.panelHeader}><h2><button className={styles.libraryOpen} data-library-open onClick={() => search.current?.focus()}>Ajouter à mon mois</button></h2></header>
    <label className={styles.search} title="Rechercher dans la bibliothèque (/)" ><Search size={15} aria-hidden="true" />
      <input ref={search} data-library-search aria-label="Rechercher une intention" value={query} onChange={e => setQuery(e.target.value)} placeholder="Une idée en tête ?"
        onKeyDown={e => { if (e.key === "Enter" && query && !busy && (presets.length || groups[0]?.matches[0])) { e.preventDefault(); if (presets[0]) choosePreset(presets[0].asset, presets[0].preset.presetKey); else choose(groups[0].matches[0]); }
          else if (e.key === "ArrowDown" && visibleAssets.length) { e.preventDefault(); e.currentTarget.closest("aside")?.querySelector<HTMLButtonElement>("[data-asset]")?.focus(); } }} /></label>
    <div className={styles.libraryScroll}>{presets.length > 0 && <section className={styles.assetGroup} data-preset-library><h3>Des idées pour vous</h3><div className={styles.presetGrid}>{presets.map(({preset,asset}) => <button key={preset.presetKey} type="button" className={styles.presetTile} data-preset={preset.presetKey} disabled={busy} onFocus={() => preloadEditorForPreset(asset)} onClick={() => choosePreset(asset,preset.presetKey)}><PresetIllustration preset={preset} /><span>{preset.label}</span></button>)}</div></section>}{visibleGroups.map(section => <section key={section.sectionKey} className={styles.assetGroup} data-library-group={section.sectionKey}>
      <h3><button type="button" className={styles.assetGroupToggle} data-library-group-toggle={section.sectionKey}
        aria-expanded={section.expanded} aria-controls={`composer-assets-${section.sectionKey}`} disabled={!!query.trim()}
        onClick={() => toggleGroup(section.sectionKey)}
        onKeyDown={e => { if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return; e.preventDefault();
          const headings = Array.from(e.currentTarget.closest("aside")!.querySelectorAll<HTMLButtonElement>("[data-library-group-toggle]"));
          const index = headings.indexOf(e.currentTarget);
          headings[e.key === "Home" ? 0 : e.key === "End" ? headings.length - 1 : Math.max(0, Math.min(headings.length - 1, index + (e.key === "ArrowUp" ? -1 : 1)))]?.focus(); }}>
        <span aria-hidden="true">{section.expanded ? "▾" : "▸"}</span>{section.label}<small>{section.matches.length}{query ? ` / ${section.total}` : ""}</small>
      </button></h3>
      <div id={`composer-assets-${section.sectionKey}`} className={styles.assetGrid}>{section.expanded && section.matches.map(asset => {
        const source = model.presentation.dragSources[asset.assetKey];
        const draggable = (!!source?.editorDropTarget || (composerRenderIndex(model).drops.get(asset.assetKey) ?? []).some(d => d.resolution !== "BLOCKED")) && asset.provenance !== "DERIVED_CONSEQUENCE";
        return <button type="button" className={styles.asset} key={asset.assetKey} data-asset={asset.assetKey} data-selected={selected === asset.assetKey} disabled={busy}
          title={`${asset.label}${source?.editorTargetRef ? " · choisir une allocation" : ""} · parcourir avec les flèches`}
          tabIndex={(section.matches.some(item => item.assetKey === activeAsset) ? activeAsset : section.matches[0]?.assetKey) === asset.assetKey ? 0 : -1}
          onFocus={() => { setActiveAsset(asset.assetKey); preloadEditorForAsset(asset); }}
          onPointerEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current);
            hoverTimer.current = setTimeout(() => preloadEditorForAsset(asset), 150); }}
          onPointerLeave={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = null; }}
          onPointerDown={() => preloadEditorForAsset(asset)}
          onKeyDown={e => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return; e.preventDefault();
            const assets = Array.from(e.currentTarget.closest("aside")!.querySelectorAll<HTMLButtonElement>("[data-asset]")), index = assets.indexOf(e.currentTarget);
            const next = e.key === "Home" ? 0 : e.key === "End" ? assets.length - 1 : index + (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -2 : 2);
            assets[Math.max(0, Math.min(assets.length - 1, next))]?.focus(); }}
          draggable={draggable && !busy} data-drag-source={asset.assetKey} data-grabbed={interaction?.grabbed?.sourceKey === asset.assetKey}
          onDragStart={e => { preloadEditorForAsset(asset); if (interaction) interaction.start(asset.assetKey, e); else { e.dataTransfer.setData("application/x-planner-asset", asset.assetKey); drag(asset.assetKey); } }}
          onDragEnd={() => { interaction?.end(); drag(null); }} onClick={() => choose(asset)}>
          <PlannerIcon iconKey={asset.iconKey} identityRef={asset.capabilityRef} scale="LIBRARY" className={styles.assetIcon} /><span>{asset.label}</span>
        </button>;
      })}</div></section>)}{!groups.length && !presets.length && <p className={styles.searchEmpty}>Aucun élément trouvé.</p>}</div>
  </aside>;
}
