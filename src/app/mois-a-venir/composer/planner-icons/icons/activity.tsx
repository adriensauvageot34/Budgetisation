import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function ActivityIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><circle cx="27" cy="25" r="14" fill="var(--sculpture-violet)"/><path d="m36 25 20 26H20z" fill="var(--sculpture-sage)"/><rect x="10" y="36" width="23" height="18" rx="7" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
