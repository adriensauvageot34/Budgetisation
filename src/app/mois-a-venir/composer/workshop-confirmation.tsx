"use client";
import { createContext, useContext, useEffect, useCallback, useRef, useState, type ReactNode } from "react";
import styles from "./composer.module.css";

type Confirmation = { message: string; accept: () => void; acceptLabel?: string; cancelLabel?: string;
  save?: { label: string; run(): boolean } };
type RequestConfirmation = (confirmation: Confirmation) => void;
const ConfirmationContext = createContext<RequestConfirmation>(() => {});
export const useWorkshopConfirmation = () => useContext(ConfirmationContext);

/** A UI continuation only. No decision is admitted before the explicit response. */
export function WorkshopConfirmationProvider({ children, requestRef }: { children: ReactNode;
  requestRef: { current: RequestConfirmation } }) {
  const pendingRef = useRef<Confirmation | null>(null);
  const [pending, setPending] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), origin = useRef<HTMLElement | null>(null), input = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => { if (event.target instanceof HTMLElement && event.target.matches("input,textarea,select") && !dialog.current?.contains(event.target)) input.current = event.target; };
    document.addEventListener("focusin", remember); return () => document.removeEventListener("focusin", remember);
  }, []);
  const request: RequestConfirmation = useCallback(confirmation => {
    if (pendingRef.current) return;
    origin.current = input.current?.isConnected ? input.current : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingRef.current = confirmation; setPending(confirmation);
  }, []);
  useEffect(() => { requestRef.current = request; return () => { requestRef.current = () => {}; pendingRef.current = null; }; }, [requestRef, request]);
  useEffect(() => {
    if (pending && !dialog.current?.open) { dialog.current?.showModal(); dialog.current?.querySelector<HTMLButtonElement>("[data-keep-editing]")?.focus(); }
  }, [pending]);
  const respond = (accepted: boolean | "save") => {
    const action = pendingRef.current; if (!action) return;
    pendingRef.current = null;
    dialog.current?.close(); setPending(null);
    const invoker = origin.current;
    if (accepted==="save") { if (!action.save?.run() && invoker?.isConnected) invoker.focus({preventScroll:true}); }
    else if (accepted) action.accept();
    // Layout effects may move focus after admission. Only cancellation restores the RAW field.
    else if (invoker?.isConnected) invoker.focus({ preventScroll: true });
  };
  return <ConfirmationContext.Provider value={request}>{children}
    <dialog ref={dialog} className={styles.workshopConfirmation} aria-labelledby="workshop-confirmation-title"
      aria-describedby="workshop-confirmation-message" data-workshop-confirmation
      onCancel={event => { event.preventDefault(); respond(false); }}>
      <h2 id="workshop-confirmation-title">Avant de continuer</h2>
      <p id="workshop-confirmation-message">{pending?.message}</p>
      <footer><button type="button" data-keep-editing autoFocus onClick={() => respond(false)}>{pending?.cancelLabel ?? "Continuer à modifier"}</button>
        {pending?.save&&<button type="button" data-save-workshop onClick={()=>respond("save")}>{pending.save.label}</button>}
        <button type="button" data-confirm-workshop onClick={() => respond(true)}>{pending?.acceptLabel ?? "Confirmer"}</button></footer>
    </dialog>
  </ConfirmationContext.Provider>;
}
