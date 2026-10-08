import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function CoffeeIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><ellipse cx="31" cy="55" rx="23" ry="4" fill="var(--sculpture-shadow)" opacity=".32"/><path d="M13 25h36v15c0 10-7 15-18 15s-18-5-18-15z" fill="var(--sculpture-ivory)"/><path d="M49 29h5c10 0 8 15-5 15" stroke="var(--sculpture-peach)" strokeWidth="5"/><ellipse cx="31" cy="25" rx="18" ry="6" fill="var(--sculpture-ivory)"/><ellipse cx="31" cy="25" rx="14" ry="4" fill="var(--sculpture-coffee)"/></ClayFrame>;
}
