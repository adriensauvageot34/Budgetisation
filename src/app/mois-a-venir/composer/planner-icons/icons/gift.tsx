import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function GiftIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="13" y="29" width="38" height="24" rx="6" fill="var(--sculpture-peach)"/><rect x="10" y="23" width="44" height="12" rx="5" fill="var(--sculpture-ivory)"/><path d="M32 26v27" stroke="var(--sculpture-violet)" strokeWidth="6"/><path d="M31 23c-20-1-13-19 0-3 13-16 20 2 1 3" stroke="var(--sculpture-violet)" strokeWidth="5"/></ClayFrame>;
}
