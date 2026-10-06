import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function TramIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="17" y="10" width="31" height="41" rx="11" fill="var(--sculpture-sage)"/><rect x="21" y="19" width="23" height="16" rx="6" fill="var(--sculpture-ivory)"/><path d="M21 55h23M25 50l-4 6M40 50l4 6" stroke="var(--sculpture-shadow)" strokeWidth="3"/><circle cx="25" cy="42" r="3" fill="var(--sculpture-gold)"/><circle cx="40" cy="42" r="3" fill="var(--sculpture-gold)"/></ClayFrame>;
}
