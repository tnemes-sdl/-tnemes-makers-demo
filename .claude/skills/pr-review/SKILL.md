## Scope

Review only:

`git diff origin/main...HEAD`

and the files touched by that diff.

Do not review unrelated parts of the repository unless they are necessary
to understand the changed code.

## Gate decision

Decide whether the pull request contains any blocking issue.

A blocking issue is a concrete problem likely to cause:
- incorrect behaviour;
- a regression;
- a security vulnerability;
- data loss or corruption;
- significant reliability problems;
- tests that give false confidence about the changed behaviour.

Do not block for:
- formatting;
- naming preferences;
- minor refactoring opportunities;
- speculative issues without a realistic failure scenario;
- missing documentation unless required for correctness.

If there is a blocking issue, explain it clearly and finish with:

VERDICT: BLOCK

Otherwise finish with:

VERDICT: APPROVE

The verdict must be the final line of the response.
Write nothing after the verdict.