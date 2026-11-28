/** Update only the parameters owned by the open view, without fetching the route again. */
export function replaceViewSearch(values: Readonly<Record<string, string | undefined>>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}
