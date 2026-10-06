import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function BeautyIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="15" y="27" width="13" height="27" rx="6" fill="var(--sculpture-violet)"/><rect x="17" y="12" width="9" height="21" rx="4" fill="var(--sculpture-ivory)"/><rect x="35" y="31" width="17" height="23" rx="6" fill="var(--sculpture-ivory)"/><rect x="38" y="19" width="11" height="15" rx="4" fill="var(--sculpture-sage)"/><path d="M19 34v12M40 38v9" stroke="var(--sculpture-ivory)" strokeWidth="3"/></ClayFrame>;
}
