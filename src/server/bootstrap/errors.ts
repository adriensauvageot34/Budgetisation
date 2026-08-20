export class BootstrapAuthenticationRequiredError extends Error {
  constructor() {
    super("Une session Supabase valide est requise.");
    this.name = "BootstrapAuthenticationRequiredError";
  }
}

export class BootstrapDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapDataError";
  }
}

export class AmbiguousHouseholdError extends BootstrapDataError {
  constructor() {
    super("Plusieurs foyers sont accessibles : le contexte du bootstrap est ambigu.");
    this.name = "AmbiguousHouseholdError";
  }
}
