declare const __brand: unique symbol;

export type Brand<T, Name extends string> = T & {
  readonly [__brand]: { readonly [Key in Name]: true };
};
