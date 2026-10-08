import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function GiftIcon(props: ClayIconProps) {
  return <ClayFrame {...props}>
    <path d="M13 30h39v20c0 3-3 5-6 5H19c-3 0-6-2-6-5V30z" fill="var(--sculpture-peach)"/>
    <path d="M44 31h8v19c0 3-3 5-6 5h-5l3-4V31z" fill="var(--sculpture-coral)" opacity=".8"/>
    <rect x="9" y="24" width="47" height="10" rx="4" fill="var(--sculpture-ivory)"/>
    <path d="M28 25h8v30h-8z" fill="var(--sculpture-violet)"/>
    <path d="M31 24c-7-1-14-4-12-9 2-5 10 0 13 8 3-8 11-13 13-8 2 5-5 8-13 9z" fill="var(--sculpture-violet)"/>
    <path d="M16 39h9" stroke="#fff5eb" strokeWidth="2" opacity=".6"/>
  </ClayFrame>;
}
