import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function CarIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M18 29 23 18h19l6 12" fill="var(--sculpture-ivory)"/><rect x="9" y="28" width="47" height="20" rx="9" fill="var(--sculpture-blue)"/><circle cx="20" cy="47" r="7" fill="var(--sculpture-shadow)"/><circle cx="46" cy="47" r="7" fill="var(--sculpture-shadow)"/><path d="M16 34h33" stroke="var(--sculpture-pearl)" strokeWidth="4"/></ClayFrame>;
}
