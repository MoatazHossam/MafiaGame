# Invitation routing and small-group rules

## What changed

Previously a shared `/?room=CODE` link opened the landing page and silently selected the join tab far below its hero. A new guest still saw the general home screen, and the default fox avatar often conflicted with the host. The invitation now has its own `/join/CODE` route and visible join screen. Older query links remain supported and go to that same UI.

The invited code is fixed by the URL. Before joining, the server returns only a public room preview: code, host display name, accepted count, occupied avatar numbers, and whether joining is open. No player list, roles, private actions, session data, or internal room state is returned. A guest chooses a name and an unoccupied avatar, submits, then waits for host approval. Full, started, missing, expired, and malformed invitations have explicit messages instead of returning silently to the home screen. A browser already in the invited room resumes the same player; an invitation to another room asks the player to continue or leave their existing room rather than silently replacing it.

## Player counts

The app counts **active participants only**. There is no extra human moderator: narration and adjudication are handled by the server. There is no single universal Mafia minimum or role distribution across all variants. The following is the product's chosen setup for new games, not a proven claim of equal win rates:

| Participants | Mafia | Doctor | Detective | Citizens | Intended use |
| --- | --- | --- | --- | --- | --- |
| 4 | 1 | 0 | 0 | 3 | Short, experimental small group |
| 5 | 1 | 0 | 0 | 4 | Short, experimental small group |
| 6 | 1 | 1 | 1 | 3 | Recommended minimum for the full four-role experience |
| 7 | 1 | 1 | 1 | 4 | Small group with all role types |
| 8 | 2 | 1 | 1 | 4 | Existing setup preserved |
| 9 | 2 | 1 | 1 | 5 | Existing setup preserved |
| 10 | 2 | 1 | 1 | 6 | Existing setup preserved |
| 11 | 3 | 1 | 1 | 6 | Existing setup preserved |
| 12 | 3 | 1 | 1 | 7 | Existing setup preserved |

Four- and five-player games retain the existing night-first cycle and parity win condition. They can end after one wrong daytime elimination; their short duration is intentional and described in the UI. They do not add powerful special roles just to fill a small deck. Six or more is recommended for a richer deduction experience. Role assignment uses a shared setup function, the server enforces a four-player minimum, and UI readiness gates and documentation use the same count. Existing role assignments in matches already running are unchanged.

## Research notes

- [Instructables](https://www.instructables.com/How-To-Play-Mafia-with-And-Without-Cards/) describes at least four participants, with a separate mayor/narrator not counted among them, and prefers larger groups. That is not the same as four people including a moderator.
- [Mafia Role Assigner's six-player variant](https://mafiarole.com/how-to-play/6-players) gives one mafia, one doctor, one detective, and three villagers. Its claim of balance is a guide's recommendation, not evidence that this app's outcomes are statistically balanced.
- [Original-rules reproduction attributed to Davidoff](https://www.maximumawesome.com/articles/mafiaoriginal.htm) starts at six with a different role ratio, illustrating that variants differ.

No game-economy, timer, secrecy, elimination-reveal, or victory-condition changes are included in this update.
