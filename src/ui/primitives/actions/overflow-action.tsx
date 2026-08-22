import { Ellipsis } from "lucide-react";
import { IconButton, type IconButtonProps } from "./icon-button";

export type OverflowActionProps<NavigationIntent = never> = Omit<
  IconButtonProps<NavigationIntent>,
  "icon" | "label"
> & { readonly label?: string };

export function OverflowAction<NavigationIntent = never>({
  label = "Plus d’actions",
  ...props
}: OverflowActionProps<NavigationIntent>) {
  return <IconButton {...props} icon={Ellipsis} label={label} />;
}
