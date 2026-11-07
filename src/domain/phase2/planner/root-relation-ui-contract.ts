import type { ComposerLocalFrame } from "./root-relation-local";
import type { RootRelationCapabilities, RootRelationMutation } from "./root-relation-contract";
export const ROOT_RELATION_HTTP_CONTRACT = "composer-root-relations-local@1";
export type RootRelationBinding = Readonly<{ draftId: string; version: number }>;
/** Server availability hint, never an authorization grant. Scope also permits conservative recovery after revocation. */
export type RootRelationAccess = Readonly<{ scopeKey: string; enabled: boolean; durable?: boolean }>;
type RequestBase = Readonly<{ sequence: number; targetMonth: string; binding: RootRelationBinding; frame: ComposerLocalFrame }>;
export type RootRelationRequest = RequestBase & (
  | Readonly<{ kind: "READ" }>
  | Readonly<{ kind: "MUTATE"; authorityToken: string; expectedStateDigest: string; mutation: RootRelationMutation }>
  | Readonly<{ kind: "RESTORE"; authorityToken: string; expectedStateDigest: string; proposed: ComposerLocalFrame }>);
export type RootRelationResponse = Readonly<{ ok: true; sequence: number; sourceDigest: string; frame: ComposerLocalFrame;
  capabilities: RootRelationCapabilities; authorityToken: string }>
  | Readonly<{ ok: false; sequence: number; code: string; message: string }>;
export type RootRelationTransport = (request: RootRelationRequest) => Promise<RootRelationResponse>;
