import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function FamilyIcon(props: ClayIconProps) {
  return <ClayFrame {...props}>
    <path d="M14 26 32 11l18 15v23H14V26z" fill="var(--sculpture-pearl)" opacity=".8"/>
    <path d="M11 27 32 9l21 18" stroke="var(--sculpture-violet)" strokeWidth="5"/>
    <path d="M15 49c1-10 12-15 20-9 4 3 5 7 5 12H15z" fill="var(--sculpture-sage)"/>
    <path d="M33 52c0-10 7-15 15-15 7 0 11 7 11 15H33z" fill="var(--sculpture-violet)"/>
    <circle cx="26" cy="28" r="8" fill="var(--sculpture-ivory)"/>
    <circle cx="46" cy="29" r="7" fill="var(--sculpture-ivory)"/>
    <circle cx="36" cy="39" r="5" fill="var(--sculpture-peach)"/>
  </ClayFrame>;
}
