import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function LodgingIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="11" y="17" width="43" height="31" rx="8" fill="var(--sculpture-ivory)"/><rect x="8" y="34" width="49" height="17" rx="7" fill="var(--sculpture-violet)"/><rect x="17" y="22" width="29" height="12" rx="6" fill="var(--sculpture-ivory)"/><path d="M14 48v7M51 48v7" stroke="var(--sculpture-shadow)" strokeWidth="4"/></ClayFrame>;
}
