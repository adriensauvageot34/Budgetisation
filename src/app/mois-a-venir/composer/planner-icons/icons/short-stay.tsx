import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function ShortStayIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M5 45 25 14l13 21 8-12 13 22z" fill="var(--sculpture-sage)"/><path d="M25 14 38 35 31 45H19z" fill="var(--sculpture-shadow)" opacity=".22"/><path d="m17 27 8-13 8 13-8-4z" fill="var(--sculpture-ivory)"/><path d="m40 32 6-9 7 10-7-4z" fill="var(--sculpture-ivory)"/><path d="M18 51 32 33l14 18z" fill="var(--sculpture-peach)"/><path d="M32 33 46 51H32z" fill="var(--sculpture-coral)" opacity=".38"/><path d="M32 33v18" stroke="var(--sculpture-coffee)" strokeWidth="2"/><path d="M7 53h52" stroke="var(--sculpture-sage)" strokeWidth="4"/></ClayFrame>;
}
