import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function TicketIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M10 20h44v11c-9 0-9 11 0 11v9H10v-9c9 0 9-11 0-11z" fill="var(--sculpture-violet)"/><path d="M38 23v25" stroke="var(--sculpture-pearl)" strokeWidth="3" strokeDasharray="2 5"/><circle cx="25" cy="35" r="7" fill="var(--sculpture-ivory)"/></ClayFrame>;
}
