import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function DeliveryIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><circle cx="18" cy="49" r="6" fill="var(--sculpture-plum)"/><circle cx="48" cy="49" r="6" fill="var(--sculpture-plum)"/><path d="M8 42h35l9 6H11z" fill="var(--sculpture-coral)"/><path d="M16 26h21l6 16H10z" fill="var(--sculpture-coral)"/><path d="M22 25v-9h13v9" stroke="var(--sculpture-gold)" strokeWidth="4"/><path d="M38 32h11l5 12H41z" fill="var(--sculpture-peach)"/></ClayFrame>;
}
