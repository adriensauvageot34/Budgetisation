import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function RestaurantIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><ellipse cx="33" cy="34" rx="19" ry="20" fill="var(--sculpture-ivory)"/><ellipse cx="33" cy="31" rx="19" ry="20" fill="var(--sculpture-ivory)"/><ellipse cx="33" cy="31" rx="12" ry="13" fill="var(--sculpture-peach)"/><path d="M8 16v32M5 16v10h6V16M56 16v32" stroke="var(--sculpture-violet)" strokeWidth="3"/></ClayFrame>;
}
