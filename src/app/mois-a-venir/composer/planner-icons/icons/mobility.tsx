import { ClayFrame, type ClayIconProps } from "../clay-frame";

/** A route and two places, without asserting a transport mode. */
export function MobilityIcon(props: ClayIconProps) {
  return <ClayFrame {...props}>
    <path d="M18 44c5-13 12-4 19-14 3-4 6-6 11-6" stroke="var(--sculpture-blue)" strokeWidth="7" />
    <path d="M9 28c0-7 5-12 11-12s11 5 11 12c0 8-11 19-11 19S9 36 9 28Z" fill="var(--sculpture-coral)" />
    <circle cx="20" cy="28" r="4" fill="var(--sculpture-ivory)" />
    <path d="M39 20c0-6 4-10 9-10s9 4 9 10c0 7-9 16-9 16s-9-9-9-16Z" fill="var(--sculpture-violet)" />
    <circle cx="48" cy="20" r="3.5" fill="var(--sculpture-ivory)" />
  </ClayFrame>;
}
