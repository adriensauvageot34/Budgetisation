import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function FuelIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="12" y="13" width="29" height="39" rx="7" fill="var(--sculpture-peach)"/><rect x="17" y="19" width="19" height="12" rx="4" fill="var(--sculpture-ivory)"/><path d="M40 27c17-3 4 23 12 23 6 0 5-24 1-29l-5-5" stroke="var(--sculpture-sage)" strokeWidth="5"/><path d="M12 53h30" stroke="var(--sculpture-violet)" strokeWidth="5"/></ClayFrame>;
}
