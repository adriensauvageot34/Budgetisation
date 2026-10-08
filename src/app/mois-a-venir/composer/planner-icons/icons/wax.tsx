import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function WaxIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M14 28h36l-3 24H17z" fill="var(--sculpture-peach)"/><ellipse cx="32" cy="28" rx="18" ry="6" fill="var(--sculpture-gold)"/><path d="M13 25c0-5 5-8 19-8s19 3 19 8v5H13z" fill="var(--sculpture-ivory)"/><ellipse cx="32" cy="27" rx="11" ry="2" fill="var(--sculpture-coffee)"/></ClayFrame>;
}
