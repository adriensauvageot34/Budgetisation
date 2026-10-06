import { ClayFrame, type ClayIconProps } from "../clay-frame";
export function TicketIcon(props: ClayIconProps) {
  return <ClayFrame {...props}><path d="M10 20h44v11c-9 0-9 11 0 11v9H10v-9c9 0 9-11 0-11z" fill="#d5c9df"/><path d="M38 23v25" stroke="#eee7f1" strokeWidth="3" strokeDasharray="2 5"/><circle cx="25" cy="35" r="7" fill="#eee5d6"/></ClayFrame>;
}
