import { ArrowLeft, X } from "lucide-react";
import { IconButton, type UiAction } from "../primitives";

export type OverlayHeaderProps<NavigationIntent = never> = {
  readonly title: string;
  readonly titleId?: string;
  readonly subtitle?: string;
  readonly closeAction?: UiAction<NavigationIntent>;
  readonly backAction?: UiAction<NavigationIntent>;
};

export function OverlayHeader<NavigationIntent = never>({
  title,
  titleId,
  subtitle,
  closeAction,
  backAction,
}: OverlayHeaderProps<NavigationIntent>) {
  return (
    <header className="ui-overlay-header">
      {backAction ? (
        <IconButton icon={ArrowLeft} label="Revenir au niveau précédent" action={backAction} />
      ) : null}
      <div className="ui-overlay-heading">
        <h2 id={titleId} data-overlay-title="" tabIndex={-1}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {closeAction ? (
        <IconButton icon={X} label="Fermer" action={closeAction} />
      ) : null}
    </header>
  );
}
