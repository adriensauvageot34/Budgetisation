import { validationFailure } from "../validation";
import {
  parseContractVersion,
  type ContractVersion,
} from "../versions";

export const LEGACY_CONTRACT_VERSION = parseContractVersion("v1");
export const HISTORY_V2_CONTRACT_VERSION = parseContractVersion("v2");

// Kept as the V1 default for existing callers. A Query resource must resolve
// its effective contract through the resource contract registry.
export const CURRENT_CONTRACT_VERSION = LEGACY_CONTRACT_VERSION;

export function parseSupportedContractVersion(
  value: unknown,
): ContractVersion {
  const version = parseContractVersion(value);
  if (
    version !== LEGACY_CONTRACT_VERSION
    && version !== HISTORY_V2_CONTRACT_VERSION
  ) {
    validationFailure({
      path: [],
      code: "unsupported_contract_version",
      message: "La version du contrat API n'est pas supportée.",
    });
  }
  return version;
}
