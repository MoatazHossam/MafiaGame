/** Product rules for NEW matches. The narrator is the app, not an extra player. */
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
export const RECOMMENDED_PLAYERS = 6;
export function roleCounts(count: number) {
  if (!Number.isInteger(count) || count < MIN_PLAYERS || count > MAX_PLAYERS) throw new RangeError('Supported player count: 4–12');
  const mafia = count >= 11 ? 3 : count >= 8 ? 2 : 1;
  const doctor = count >= 6 ? 1 : 0;
  const detective = count >= 6 ? 1 : 0;
  return {mafia, doctor, detective, citizen: count - mafia - doctor - detective};
}
