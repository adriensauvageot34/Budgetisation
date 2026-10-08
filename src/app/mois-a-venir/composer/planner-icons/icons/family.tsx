import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function FamilyIcon(props: ClayIconProps) {
  return <ClayFrame {...props}>
    <path d="M11 27 32 9l21 18-4 3-17-14-17 14z" fill="var(--sculpture-violet)"/>
    <path d="M15 28 32 14l17 14v22H15z" fill="var(--sculpture-pearl)" opacity=".9"/>
    <path d="M32 14 49 28v22H32z" fill="var(--sculpture-shadow)" opacity=".36"/>
    <path d="M19 52c0-10 5-16 13-16s13 6 13 16z" fill="var(--sculpture-sage)"/>
    <path d="M39 52c0-9 4-14 10-14 7 0 11 6 11 14z" fill="var(--sculpture-violet)"/>
    <circle cx="28" cy="29" r="8" fill="var(--sculpture-ivory)"/>
    <circle cx="48" cy="30" r="7" fill="var(--sculpture-ivory)"/>
    <circle cx="38" cy="41" r="5" fill="var(--sculpture-peach)"/>
    <path d="M23 25c2-3 5-4 8-3m13 4c2-2 4-2 6-1" stroke="#fff" strokeWidth="1.5" opacity=".7"/>
  </ClayFrame>;
}
