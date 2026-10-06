import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function BeforeIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><rect x="25" y="10" width="13" height="15" rx="4" fill="var(--sculpture-violet)"/><path d="M26 22h11c0 8 8 10 8 17v12c0 4-26 4-26 0V39c0-7 7-9 7-17" fill="var(--sculpture-sage)"/><rect x="21" y="36" width="22" height="12" rx="4" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
