import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function FamilyIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M8 49c0-14 27-15 27 0v3H8z" fill="var(--sculpture-sage)"/><path d="M30 49c0-14 26-15 26 0v3H30z" fill="var(--sculpture-violet)"/><circle cx="21" cy="23" r="10" fill="var(--sculpture-ivory)"/><circle cx="43" cy="26" r="9" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
