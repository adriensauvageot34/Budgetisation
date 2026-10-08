import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function MascaraIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M24 31h17v22H24z" fill="var(--sculpture-violet)"/><path d="M23 23h19v10H23z" fill="var(--sculpture-plum)"/><path d="M31 8h3v15h-3z" fill="var(--sculpture-shadow)"/><path d="M24 8h18M25 11h17M26 14h15" stroke="var(--sculpture-plum)" strokeWidth="2"/></ClayFrame>;
}
