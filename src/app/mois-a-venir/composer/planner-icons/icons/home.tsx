import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function HomeIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="16" y="26" width="33" height="27" rx="8" fill="var(--sculpture-ivory)"/><path d="m12 27 20-17 21 17" stroke="var(--sculpture-violet)" strokeWidth="8"/><rect x="28" y="36" width="10" height="17" rx="4" fill="var(--sculpture-sage)"/></ClayFrame>;
}
