import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function NightOutIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M32 7v9" stroke="var(--sculpture-violet)" strokeWidth="3"/><circle cx="32" cy="33" r="21" fill="var(--sculpture-violet)"/><path d="M15 24c5-10 23-15 32-4-13-4-22-1-32 4" fill="var(--sculpture-pearl)"/><path d="M14 40c11 11 28 10 36-2-7 17-29 19-36 2" fill="var(--sculpture-shadow)"/><path d="m28 23 9 5-4 12-10-4z" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
