Q1 — Core game loop

Question: Are the 10 rounds, 10-second timer, scoring system, and speed bonus actually intended, or just what currently exists?
Answer: Keep the current game loop as-is. The goal is to spec the existing implementation, not redesign it.

Q2 — Audience and use case

Question: Who is the game intended for?
Answer: A casual browser-based geography game for general users.

Q3 — localStorage unavailability

Question: What should happen if localStorage is unavailable?
Answer: Silent failure is acceptable for now; personal best tracking is non-critical.

Q4 — Open questions vs acceptance criteria

Question: Should some open questions become acceptance criteria?
Answer: Keep them as open questions unless they describe behaviour that is already observable in the current application.

Q5 — Map loading behaviour

Question: Does the GeoJSON load immediately or only after starting the game?
Answer: Verify against the current implementation and update the spec to match the actual behaviour.

Q6 — Score/verdict thresholds

Question: Are the score thresholds justified or arbitrary?
Answer: Keep the current thresholds as existing behaviour. There is no need to justify or redesign them for this exercise.

Q7 — Keyboard shortcuts

Question: Should keyboard shortcuts be included in the spec?
Answer: Yes. Add existing keyboard controls to user-visible behaviour and acceptance criteria.

Q8 — Timer drift

Question: What happens if the browser tab is suspended or the OS sleeps?
Answer: Treat timer drift as a known limitation unless the existing implementation already handles it.

Q9 — Personal best ordering

Question: Does the application store the five best games or the five most recent games?
Answer: Store the five best games ever, ordered by score descending.

Q10 — System clock changes

Question: What happens if the system clock changes during a round?
Answer: Treat system clock changes as an edge-case limitation and out of scope unless the current implementation explicitly handles them.

Q11 — Clear bests safety

Question: Should clearing personal bests require confirmation?
Answer: Keep the current behaviour. If clearing is instant today, document it rather than adding a new confirmation step.

Q12 — Equal personal best scores

Question: What is the ordering when two saved scores are equal?
Answer: Verify the current behaviour. If there is no explicit tiebreaker, document the ordering as unspecified.

Q13 — Small-screen dialog behaviour

Question: What happens to the end-game dialog on small/mobile screens?
Answer: Test the current behaviour on a small viewport and document what actually happens. Do not redesign it unless necessary.

Q14 — Accessibility

Question: Does the game need to meet a specific accessibility standard?
Answer: There is no explicit WCAG requirement for this exercise. Document existing accessibility and keyboard behaviour; broader accessibility improvements are out of scope.

Q15 — Browser compatibility

Question: Which browsers should be supported?
Answer: Modern browsers only. Legacy browser support is not required.

Q16 — Distance locale formatting

Question: Should distance formatting use a fixed locale or the player's system locale?
Answer: Verify the current formatting behaviour and document what exists rather than choosing a new locale strategy.

Q17 — City difficulty

Question: Should all cities be equally easy to locate?
Answer: No. Variation in city difficulty is expected game behaviour and is not considered a bug.

Q18 — Closing/reloading during a game

Question: Should an unfinished game be recoverable after closing or reloading the browser?
Answer: No. Losing in-progress game state after closing or reloading is expected. Resume/recovery is out of scope.

Q19 — Visual design

Question: Should fonts, colours, spacing, etc. be part of this spec?
Answer: Keep detailed visual styling out unless it affects user-visible behaviour. Visual design can be handled separately.

Q20 — Performance requirements

Question: Should there be performance or bundle-size targets?
Answer: No explicit performance or bundle-size targets are required for this exercise.

Q21 — Clear bests actual behaviour

Question: Does Clear Bests instantly delete history?
Answer: Yes. Clearing is instant, with no confirmation and no undo. Document this explicitly.

Q22 — Keyboard behaviour while dialog is open

Question: Do keyboard shortcuts still work when the end-game dialog is open?
Answer: Verify the actual behaviour and document what is observed.

Q23 — Guessing edge cases

Question: What happens if the player clicks the same location twice or clicks at extreme map bounds?
Answer: Verify both cases in the running application. Document the actual user-visible behaviour rather than inventing additional constraints.

Q24 — Speed bonus clamping

Question: Should the exact clamping logic for the speed bonus be included?
Answer: No. “Up to 20% speed bonus” is sufficient for the user-facing spec. The clamping formula is an implementation detail unless it materially affects observable behaviour.

Q25 — Dialog dismissal

Question: Can the end-game dialog be dismissed by clicking outside it or pressing Escape?
Answer: Verify the current behaviour. Escape is already known to be blocked; document whether backdrop clicks are also blocked.

Q26 — Next Round repeated clicks

Question: Can the player repeatedly click Next Round and accidentally skip rounds?
Answer: Verify whether the UI prevents multiple advances. Document the observable behaviour; implementation-level idempotency does not need to be specified unless it is a technical requirement.

Q27 — Marker lifecycle

Question: Do the guess and target markers remain on the map between rounds?
Answer: No. The guess and target markers are cleared when advancing to the next round.

Q28 — Personal best when storage fails

Question: What should the UI show if personal best storage is unavailable?
Answer: Showing “—” for personal best while allowing the game to continue is acceptable graceful degradation and should be documented.

Q29 — Modal summary behaviour

Question: Should the modal behaviour of the end-game summary be explicitly specified?
Answer: Yes. Document that the summary is modal and cannot be dismissed using Escape or by clicking the backdrop. It can only be exited using the supported New Game action/shortcut.

Q30 — City marker and label lifecycle

Question: Should it explicitly say that the actual city marker and label disappear between rounds?
Answer: Yes. Document that the city marker and its label are cleared when advancing to the next round.

Q31 — Score rounding

Question: Should the spec describe exactly where rounding occurs inside the scoring calculation?
Answer: No. “Scores are rounded to the nearest integer” is sufficient. Internal rounding stages are implementation details.

Q32 — Non-resumable games

Question: Should the spec explicitly state that games cannot be resumed?
Answer: Yes. Document that games are not resumable and that closing or reloading the page loses the in-progress game state.

Q33 — Acceptance criteria completeness

Question: Should every visual behaviour have its own acceptance criterion?
Answer: No. Add acceptance criteria for important, independently testable behaviour. Map clearing and modal behaviour are worth covering. Visual score tiers and bonus presentation can remain under user-visible behaviour unless they are product-critical.