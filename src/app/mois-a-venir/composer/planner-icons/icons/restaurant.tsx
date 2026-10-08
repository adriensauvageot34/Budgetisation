import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function RestaurantIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><ellipse cx="32" cy="31" rx="24" ry="12" fill="var(--sculpture-ivory)"/><ellipse cx="32" cy="29" rx="19" ry="9" fill="var(--sculpture-sage)"/><circle cx="23" cy="28" r="5" fill="var(--sculpture-coral)"/><circle cx="36" cy="27" r="5" fill="var(--sculpture-gold)"/><circle cx="43" cy="32" r="4" fill="var(--sculpture-coral)"/><path d="M10 32c2 14 10 22 22 22s20-8 22-22c-8 6-36 7-44 0" fill="var(--sculpture-ivory)"/><path d="M8 18v29M5 18v10h6V18M57 18v29" stroke="var(--sculpture-plum)" strokeWidth="2"/></ClayFrame>;
}
