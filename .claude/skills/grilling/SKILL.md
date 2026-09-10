---

name: grilling
description: Grill the user relentlessly about a plan, decision, idea, or feature spec. Use when the user wants to stress-test their thinking, or uses any "grill" trigger phrases.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Interview the user relentlessly until you reach a shared understanding.

Map this as a **design tree**: every decision branches into the decisions that hang off it.

When grilling a feature spec:

* distinguish between **explicit behaviour**, **assumptions**, and **open questions**
* focus on ambiguities where two developers could implement different user-visible behaviour
* pay special attention to state transitions, edge cases, success/failure behaviour, timing, scoring, reset/completion behaviour
* do not invent or expand features that are outside the stated scope

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at answers you haven't heard yet.

Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```text id="g1"
❓ **Q1** - **<question title>**: <question body>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

A question whose answer depends on another question still open in this round belongs to a *later* round, not this one.

Finding *facts* is your job, never the user's. When a frontier question needs a fact from the environment, filesystem, tools, etc., find it yourself.

The *decisions* are the user's: put each to them and wait.

If the answer is genuinely unknown, keep it as an **Open Question** rather than silently assuming behaviour.

The session is done when the frontier is empty: every material branch of the design tree has been visited, and nothing important remains silently assumed.

Do not implement anything until the user confirms you have reached a shared understanding.

If the grilling session was started from a spec artifact or file, update that same artifact with the decisions made during the session  https://claude.ai/code/artifact/8f410d2e-ab15-4bce-8cce-94b03eb12ba5