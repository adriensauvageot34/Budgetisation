import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function BowlingIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M42 12c-6 0-4 9-3 15-10 18-8 24 4 24 12 0 13-8 2-24 2-6 3-15-3-15" fill="var(--sculpture-ivory)"/><path d="M37 30h12" stroke="var(--sculpture-violet)" strokeWidth="5"/><circle cx="24" cy="39" r="16" fill="var(--sculpture-blue)"/><circle cx="21" cy="32" r="2" fill="var(--sculpture-shadow)"/><circle cx="27" cy="32" r="2" fill="var(--sculpture-shadow)"/><circle cx="24" cy="37" r="2" fill="var(--sculpture-shadow)"/></ClayFrame>;
}
