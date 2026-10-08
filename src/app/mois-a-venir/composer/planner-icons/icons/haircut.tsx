import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function HaircutIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><circle cx="19" cy="43" r="9" stroke="var(--sculpture-coral)" strokeWidth="6"/><circle cx="45" cy="43" r="9" stroke="var(--sculpture-coral)" strokeWidth="6"/><path d="m24 36 20-23M40 36 20 13" stroke="var(--sculpture-shadow)" strokeWidth="6"/><path d="m29 29 15-16M35 29 20 13" stroke="var(--sculpture-pearl)" strokeWidth="2"/><circle cx="32" cy="27" r="4" fill="var(--sculpture-gold)"/></ClayFrame>;
}
