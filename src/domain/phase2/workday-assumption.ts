/** Existing forecast assumption: Monday–Friday on site, not a personal work schedule. */
export function isAssumedOnsiteWorkday(date: string): boolean {
  return ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
}
