---
name: pr-review
description: Review the current PR or diff for correctness, regression risk,
   hidden assumptions, and missing test coverage. Use when reviewing a pull
   request before leaving comments or approving it.
---

# PR Review

Review the current pull request as a senior engineer.

Focus on issues that could cause incorrect behaviour, regressions,
flaky behaviour, maintainability problems, security issues, or production incidents.

Do not invent issues just to produce feedback.
Avoid stylistic nitpicks unless they materially affect readability or correctness.

## 1. Summary

In at most three sentences explain:

- what the PR is trying to achieve;
- what behaviour or code it changes;
- what relevant areas it does not change.

## 2. Assumptions

Identify assumptions the changed code makes about:

- callers;
- data and inputs;
- timing or ordering;
- external systems;
- configuration;
- existing behaviour elsewhere in the repository.

For each assumption, explain what could happen if it is false.

## 3. Behaviour and tests

List each meaningful behaviour introduced or changed by the PR.

For each one:

- identify the test covering it;
- explain whether that test would actually fail if the behaviour regressed;
- flag behaviours that have no meaningful regression test.

Do not treat the mere existence of a test as sufficient coverage.

## 4. Problems

Inspect the diff for concrete problems.

Classify findings as:

- **Must fix** — likely bug, regression, security issue, data loss, or serious reliability problem.
- **Worth discussing** — design or maintainability concern with plausible impact.
- **Minor** — low-impact improvement.

For every finding:

- reference the relevant file/code;
- explain the failure scenario;
- avoid speculative warnings unless you can describe a realistic scenario.

If there are no meaningful findings, say so.

## 5. On-call perspective

Review the change as the engineer responsible for production this weekend.

Ask:

- What could fail unexpectedly?
- What would be difficult to diagnose?
- Could this produce partial failures or silent failures?
- Is there enough logging/error handling?
- Is rollback straightforward?

## 6. Final verdict

Finish with one of:

- **Looks safe to approve**
- **Approve with minor comments**
- **Changes recommended before approval**
- **Do not approve**

Give a one-sentence reason.