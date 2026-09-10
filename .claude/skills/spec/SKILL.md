---
name: spec
description: Produce a first-draft spec in the standard shape (intent,
  non-goals, user-visible behaviour, constraints, acceptance criteria,
  open questions, out of scope) from a rough description of a feature.
  Use before implementing anything non-trivial.
---

# /spec — Behaviour-Driven Feature Specification

Your job is to turn rough observations, product notes, stakeholder descriptions, or an existing application's visible behaviour into a precise implementation-ready feature specification.

The goal is not to invent a better product. The goal is to capture the intended behaviour accurately enough that another developer could implement it without seeing the original application.

## Core principles

### 1. Separate evidence from assumptions

For every important behaviour, distinguish between:

* **Observed** — directly verified in the source application or explicitly stated by the user.
* **Assumed** — not directly verified, but a concrete implementation decision is needed.
* **Open Question** — insufficient information exists and choosing an answer could materially affect behaviour.

Never silently turn an assumption into a requirement.

If a behaviour has not been observed or explicitly provided, do not present it as fact.

### 2. Specify behaviour, not implementation

Prefer:

* "Clicking the correct country marks the answer as correct."

Over:

* "Attach an onClick handler to the SVG path and update React state."

Implementation details belong in the spec only when they are genuine constraints.

### 3. Make ambiguity visible

Look for places where two competent developers could implement different behaviours while still believing they followed the spec.

Call these out explicitly.

Examples:

* automatic advance vs Next button
* whether incorrect answers reveal the correct answer
* whether repeated clicks are allowed
* what happens on empty input
* what happens after the final round
* what happens on page refresh

### 4. Keep scope small

If the requested feature appears too large for one implementation cycle, propose the smallest coherent version.

Do not silently expand the scope.

## Output format

Produce the specification using the following structure.

# Spec: <feature name>

## Intent

Explain:

* Who is this feature for?
* What user problem does it solve?
* What is the smallest useful outcome?

Keep this to 1–3 short paragraphs.

## Source / Observation Context

Briefly describe what the specification is based on.

Examples:

* behaviour observed in an existing application
* stakeholder description
* screenshots
* product demo
* existing API behaviour

Do not imply access to source code unless source code was actually provided.

## Observed Behaviour

List behaviours that were directly confirmed.

For each important behaviour, describe:

* trigger/action
* resulting behaviour
* visible state change
* relevant edge cases that were observed

Do not include guesses in this section.

## User-visible Behaviour

Describe the complete expected user flow in logical order.

Use subsections where useful, such as:

* Initial state
* Starting the feature
* User interaction
* Success
* Failure
* Navigation
* Completion/reset

This section should be implementation-ready.

If behaviour in this section comes from an assumption rather than observation, mark it inline as:

`Assumption: ...`

## State and Rules

Describe important feature rules and state transitions.

Examples:

* what state exists before interaction
* what locks after submission
* what resets between rounds
* whether actions can be repeated
* whether data persists
* what happens after completion

Focus on behaviour rather than internal architecture.

## Edge Cases

Explicitly cover relevant edge cases such as:

* empty input
* invalid input
* repeated actions
* clicking outside valid targets
* network failure
* duplicate data
* very small/large values
* refreshing or navigating away
* reaching the final item
* unavailable data

Only include edge cases relevant to the feature.

## Constraints

Include technical or product constraints only when known or deliberately chosen.

Examples:

* performance
* accessibility
* browser support
* existing technology
* API compatibility
* no paid third-party service
* maximum response time

Do not invent constraints.

## Acceptance Criteria

Write observable, testable criteria.

Each criterion should describe behaviour that can be verified from outside the implementation.

Good:

* Clicking the correct country increases the score by one.

Bad:

* The component updates its `score` state correctly.

Acceptance criteria should cover the main happy path and important failure/edge behaviour.

## Assumptions

Collect all decisions that were necessary but not confirmed from the source behaviour.

For each assumption, state why it exists when useful.

Example:

* The game contains 10 rounds. The source application's round count was not verified; 10 is chosen to keep the implementation small.

Assumptions must not be disguised as observations.

## Open Questions

List questions whose answers could materially change the implementation or UX.

Prioritise questions about:

* state transitions
* edge cases
* scoring/calculation rules
* permissions
* timing
* persistence
* error behaviour
* navigation
* ambiguous interactions

Do not include trivial implementation choices.

## Non-goals / Out of Scope

Explicitly state what will not be implemented.

Prefer concrete boundaries.

## Specification Quality Check

Before returning the spec, check:

1. Could two developers reasonably implement different user-visible behaviours from this spec?
2. Did I accidentally convert an assumption into an observed requirement?
3. Are success, failure, and completion states defined?
4. Are important state transitions defined?
5. Are acceptance criteria externally testable?
6. Is anything included that is unnecessary for the smallest useful implementation?
7. Are unresolved behaviours captured under Open Questions rather than guessed?

If any answer reveals a problem, improve the spec before returning it.

## Interaction rules

If the supplied information is insufficient:

* Do not invent missing product behaviour.
* Add the uncertainty to Open Questions.
* You may make a clearly labelled assumption when implementation cannot proceed without one.
* Prefer a small explicit assumption over a large speculative design.

After producing the spec, do not implement the feature.

Save the draft as a Claude artifact where it can be reviewed and iterated on.

Recommend running `/grill-me` next to challenge ambiguity and missing behaviour.
