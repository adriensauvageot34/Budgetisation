import { validationFailure } from "../validation";
import {
  parseContractVersion,
  type ContractVersion,
} from "../versions";

export const CURRENT_CONTRACT_VERSION = parseContractVersion("v1");

export function parseSupportedContractVersion(
  value: unknown,
): ContractVersion {
  const version = parseContractVersion(value);
  if (version !== CURRENT_CONTRACT_VERSION) {
    validationFailure({
      path: [],
      code: "unsupported_contract_version",
      message: "La version du contrat API n'est pas supportée.",
    });
  }
  return version;
}
