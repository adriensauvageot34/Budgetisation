import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { memo, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { composerPreset, type ComposerPresetKey } from "@/domain/phase2/planner/composer-presets";
import { composerLibraryAssets, LIBRARY_CATEGORIES, type LibraryIntention } from "@/domain/phase2/planner/composer-library-index";
import type { ComposerAssetView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { ComposerAssetVisual } from "./compact-catalog-visual";
import { preloadEditorForAsset } from "./editor-chunks";
import { publishedDrop, useComposerInteractions } from "./interactions";
import { PresetIllustration } from "./preset-illustration";
import { availableProjectStarters, projectStarterCategory, projectStarterContents, type ProjectStarter } from "./project-starters";
import styles from "./composer.module.css";

const FAVORITES_KEY = "budgetisation.composer.library-favorites.v1";

function navigateAssets(event: KeyboardEvent<HTMLDivElement>) {
  if (event.defaultPrevented || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  if (!(event.target instanceof HTMLButtonElement) || event.altKey || event.ctrlKey || event.metaKey) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")]
    .filter(button => button.getClientRects().length > 0);
  const current = buttons.indexOf(event.target);
  if (current < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
    : Math.max(0, Math.min(buttons.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
  buttons[next]?.focus();
}

export const ComposerLibrary = memo(function ComposerLibrary({
  model, busy, selected, choose, choosePreset, drag, prepareProject,
}: {
  model: ComposerUiModel;
  busy: boolean;
  selected: string | null;
  choose: (asset: ComposerAssetView) => void;
  choosePreset: (asset: ComposerAssetView, key: ComposerPresetKey) => void;
  drag: (key: string | null) => void;
  prepareProject?: (starter: ProjectStarter) => void;
}) {
  const [opened, setOpened] = useState<string | null>("SOCIAL");
  const [favorites, setFavorites] = useState<readonly string[]>([]);
  const interaction = useComposerInteractions();
  const { library, dropCapabilities } = model;
  const assets = useMemo(() => composerLibraryAssets({ library, dropCapabilities }), [library, dropCapabilities]);
  const families = useMemo(() => LIBRARY_CATEGORIES.map(([key, label]) => ({
    key, label, assets: assets.filter(asset => asset.category === key),
  })).filter(family => family.assets.length > 0), [assets]);
  const projects = useMemo(() => prepareProject ? availableProjectStarters(model) : [], [model, prepareProject]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
      if (Array.isArray(stored)) setFavorites(stored.filter((key): key is string => typeof key === "string").slice(0, 100));
    } catch { /* The tiles remain available when storage is unavailable. */ }
  }, []);

  function toggleFavorite(key: string) {
    const next = favorites.includes(key) ? favorites.filter(value => value !== key) : [...favorites, key];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
    catch { /* The favorite remains available for this session. */ }
  }

  function tile(item: LibraryIntention) {
    const { asset, preset } = item;
    const source = model.presentation.dragSources[asset.assetKey];
    const draggable = !!source && asset.provenance !== "DERIVED_CONSEQUENCE"
      && !!publishedDrop(model, asset.assetKey, { kind: "BOARD_ZONE" });
    const favorite = favorites.includes(item.key);
    return <div className={preset ? styles.libraryTile : styles.libraryGenericTile} key={item.key}>
      <button type="button" className={preset ? styles.presetTile : styles.libraryGenericChoice}
        data-preset={preset?.presetKey} data-asset={preset ? undefined : asset.assetKey}
        data-selected={selected === asset.assetKey} data-library-add-action={item.key} disabled={busy}
        aria-label={`Ajouter ${item.label}`} onFocus={() => preloadEditorForAsset(asset, preset?.presetKey)}
        onClick={() => preset ? choosePreset(asset, preset.presetKey) : choose(asset)}
        draggable={!busy && draggable} data-drag-source={draggable ? asset.assetKey : undefined}
        onDragStart={event => {
          event.stopPropagation();
          if (busy || !draggable) { event.preventDefault(); return; }
          if (interaction) interaction.start(asset.assetKey, event, preset?.presetKey);
          else if (preset) event.preventDefault();
          else { event.dataTransfer.setData("application/x-planner-asset", asset.assetKey); drag(asset.assetKey); }
        }}
        onDragEnd={() => { interaction?.end(); drag(null); }}>
        {preset ? <PresetIllustration preset={preset} />
          : <ComposerAssetVisual assetKey={asset.assetKey} templateKey={asset.templateKey}
              iconKey={asset.iconKey} identityRef={asset.capabilityRef} className={styles.assetIcon} />}
        <span>{item.label}</span>
      </button>
      <button type="button" className={styles.libraryFavorite} aria-pressed={favorite}
        aria-label={`${favorite ? "Retirer des favoris" : "Épingler"} ${item.label}`} onClick={() => toggleFavorite(item.key)}>
        <Star size={12} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </div>;
  }

  const pinned = assets.filter(asset => favorites.includes(asset.key));
  const projectGroups = [...new Set(projects.map(projectStarterCategory))];
  return <aside className={`${styles.library} ${styles.assetLibrary}`} data-library aria-label="Bibliothèque d’assets">
    <header className={styles.panelHeader}><h2>Assets</h2></header>
    <div className={styles.libraryScroll} data-library-scroll onKeyDown={navigateAssets}>
      {pinned.length > 0 && <section className={styles.assetGroup} aria-label="Assets épinglés" data-library-favorites>
        <h3>Épinglés</h3>
        <div className={styles.presetGrid}>{pinned.filter(asset => asset.preset).map(tile)}</div>
        {pinned.filter(asset => !asset.preset).map(tile)}
      </section>}
      {families.map(family => {
        const isOpen = opened === family.key;
        const presets = family.assets.filter(asset => asset.preset);
        const groups = [...new Set(presets.map(asset => asset.group))];
        return <section className={styles.assetGroup} key={family.key} data-library-group={family.key}>
          <h3><button type="button" className={styles.assetGroupToggle}
            data-library-group-toggle={family.key} aria-expanded={isOpen} aria-controls={`library-${family.key}`}
            onClick={() => setOpened(isOpen ? null : family.key)}>
            {isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            {family.label}
          </button></h3>
          <div id={`library-${family.key}`} hidden={!isOpen}>
            {isOpen && <>
              {groups.map(group => <div key={group} data-library-subgroup={group}>
                {group && <h4 className={styles.librarySubgroupTitle}>{group}</h4>}
                <div className={styles.presetGrid}>{presets.filter(asset => asset.group === group).map(tile)}</div>
              </div>)}
              {family.assets.filter(asset => !asset.preset).map(tile)}
            </>}
          </div>
        </section>;
      })}
      {projects.length > 0 && <details className={`${styles.assetGroup} ${styles.assetProjects}`}>
        <summary>Modèles de projets</summary>
        {projectGroups.map(group => <section key={group} aria-label={`Modèles · ${group}`}>
          <h3>{group}</h3><div className={styles.libraryProjects}>
            {projects.filter(project => projectStarterCategory(project) === group).map(project =>
              <button key={project.key} type="button" className={styles.libraryProject} disabled={busy}
                data-library-project-action={project.key} aria-label={`Prévisualiser ${project.label}`} onClick={() => prepareProject?.(project)}>
                <PresetIllustration preset={composerPreset(project.parent)!} />
                <span><strong>{project.label}</strong><small>{projectStarterContents(project)}</small></span>
              </button>)}
          </div>
        </section>)}
      </details>}
    </div>
  </aside>;
});
