/** Text layout only: the canonical label and target identity are untouched. */
export function presentationLabel(label: string) {
  const match = label.match(/\s+(Adrien|Manon)$/u);
  return { title: match ? label.slice(0, -match[0].length) : label, person: match?.[1] ?? null };
}
