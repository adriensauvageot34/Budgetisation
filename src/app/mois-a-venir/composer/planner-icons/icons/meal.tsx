import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function MealIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><ellipse cx="31" cy="37" rx="24" ry="17" fill="var(--sculpture-ivory)"/><ellipse cx="31" cy="34" rx="24" ry="17" fill="var(--sculpture-ivory)"/><ellipse cx="31" cy="34" rx="15" ry="10" fill="var(--sculpture-pearl)"/><path d="M24 32c4-6 12-5 15 1-4 6-10 7-15-1" fill="var(--sculpture-sage)"/><path d="M51 17v32" stroke="var(--sculpture-shadow)" strokeWidth="3"/></ClayFrame>;
}
