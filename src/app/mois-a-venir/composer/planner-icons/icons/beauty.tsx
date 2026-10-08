import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function BeautyIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="7" y="24" width="18" height="30" rx="5" fill="var(--sculpture-peach)"/><rect x="9" y="17" width="14" height="9" rx="3" fill="var(--sculpture-ivory)"/><rect x="26" y="18" width="17" height="36" rx="6" fill="var(--sculpture-violet)"/><rect x="30" y="10" width="9" height="10" rx="2" fill="var(--sculpture-plum)"/><rect x="43" y="34" width="16" height="20" rx="6" fill="var(--sculpture-ivory)"/><ellipse cx="51" cy="34" rx="8" ry="4" fill="var(--sculpture-gold)"/><path d="M11 31h10m9-1h9" stroke="var(--sculpture-pearl)" strokeWidth="2"/></ClayFrame>;
}
