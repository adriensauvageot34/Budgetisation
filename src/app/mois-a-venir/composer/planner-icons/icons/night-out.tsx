import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function NightOutIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M32 5v10" stroke="var(--sculpture-plum)" strokeWidth="3"/><circle cx="32" cy="34" r="21" fill="var(--sculpture-violet)"/><path d="M12 32h40M16 22h32M16 45h32M24 14v40m16-40v40" stroke="var(--sculpture-pearl)" strokeWidth="2" opacity=".72"/><path d="m24 20 8-4 9 6-5 7-10-2zM18 36l9-5 8 7-5 11-10-4z" fill="var(--sculpture-plum)" opacity=".55"/><circle cx="22" cy="23" r="2" fill="var(--sculpture-ivory)"/><circle cx="42" cy="38" r="2" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
