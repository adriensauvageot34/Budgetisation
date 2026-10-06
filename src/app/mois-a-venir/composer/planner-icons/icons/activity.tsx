import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function ActivityIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><circle cx="27" cy="25" r="14" fill="#d6c7dc"/><path d="m36 25 20 26H20z" fill="#c1cdbd"/><rect x="10" y="36" width="23" height="18" rx="7" fill="#ece2d0"/></ClayFrame>;
}
