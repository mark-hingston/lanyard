---
name: refine
description: Use when asked to refine, prepare, or get a Jira ticket ready for an agent to implement. Scores the ticket against the readiness rubric shipped with this skill (references/refine-rubric.yml), fills gaps via a one-question-at-a-time loop, rewrites the live ticket inline, then hands off to the VS Code Plan agent and posts the resulting tech notes back into the description as a managed `## Tech notes` section.
---

# Refine — Agent-Ready Ticket Preparation

You are preparing a Jira ticket for an agent to pick up. The handoff starts from the ticket, not from a conversation. A ticket a new engineer could implement confidently is the same ticket an agent can implement confidently.

**Announce at start:** "I'm using the refine skill — loading the rubric, scoring the ticket, and walking any gaps."

This skill is invoked with a Jira ticket key (e.g. `PAY-1234`). It loads the readiness rubric shipped with this skill at `references/refine-rubric.yml`, scores the ticket against it, runs a short refinement loop to fill the gaps, rewrites the live ticket inline, then hands off to the VS Code **Plan** agent to produce tech notes, and posts those tech notes back into the ticket description as a managed `## Tech notes` section.

## When to use

- Asked to "refine" or "prepare" a Jira ticket for the agent workflow
- A ticket is being handed to an implementer (human or agent) and you suspect it is not yet ready
- A refinement session has ended and you need to capture the decisions back into the ticket so they survive handoff
- A reviewer has flagged a ticket as "not ready" against the rubric
- A previous refine pass left `## Tech notes` in the description and the implementation has shifted — re-plan and replace the section

## When not to use

- The ticket is being scoped from scratch (use brainstorming / planning skills first)
- The user wants a Confluence page written (use the `confluence` skill)
- The user wants to read a ticket without changing it (use the Atlassian MCP `getIssue` directly)
- The ticket is already in the implementation phase, scoring at or above the rubric's `threshold`, and already has a `## Tech notes` section that matches the chosen direction (just implement)

## Required configuration

The Atlassian MCP server is the only supported interface for this skill. There is no REST/curl fallback. If the MCP is unreachable, the operation fails and the user is told to check their MCP configuration.

## The readiness rubric

The rubric ships with this skill at `references/refine-rubric.yml` (relative to this `SKILL.md`). It is generic — a definition-of-ready check that does not assume any team-specific platforms, dependencies, or process. The skill treats the YAML as authoritative: do not silently add, drop, or reweight criteria, and do not invent criteria of your own. If the rubric needs to change, that is a Lanyard upgrade, not a session-time edit.

Four enrichment criteria (`architecture-drawn`, `interfaces-defined`, `state-transitions`, `invariants-specified`) are **soft gates** — they warn when missing but accept a skip with a reason. They factor into the total score but the threshold stays low enough that skipping all four enrichment criteria with valid reasons does not block the ticket.

### Score buckets

The skill uses the same buckets for any rubric, derived from `threshold` and `maxScore`:

| Score | Bucket |
|-------|--------|
| `>= threshold` | **ready** |
| `>= ceil(maxScore * 0.6)` and `< threshold` | **pause for review and spec approval** |
| `< ceil(maxScore * 0.6)` | **not ready; block intake until the gaps are fixed** |

A ticket must score at least `threshold` before it is handed off to implementation.

## The process

### Step 1 — Fetch the rubric

Read `references/refine-rubric.yml` relative to this skill's `SKILL.md` (the file is shipped with the skill, so it is always present after a clean Lanyard bootstrap). Validate that `criteria` is non-empty, that `points` sum to `maxScore`, and that `threshold <= maxScore`. Refuse to proceed if any of these are violated — fix the YAML, do not silently reweight.

### Step 2 — Fetch the ticket

Read the ticket via the Atlassian MCP `getIssue` tool. Capture:

- Issue type (drives the description template — see Step 5)
- Current summary, description, AC section (if any), and any existing `## Tech notes` section (if any)
- Existing labels and components
- Status (refuse to rewrite if status is `Done`, `Closed`, or `In Progress`)

### Step 3 — Score

Walk the rubric criteria loaded in Step 1. For each, record `pass` / `fail` / `partial` with a one-line reason citing the criterion's `passWhen` text. Sum the points. Note the bucket.

If a previous `## Tech notes` section exists, also note its `updatedAt` (or version number) — this matters for the handoff in Step 8.

### Step 4 — Refinement loop

If the score is below `threshold`, run a refinement loop. Ask **one question at a time**, starting with the lowest-scoring criterion. For each gap:

1. State the failing criterion (`id` + `label`) and why it failed against `passWhen`
2. Propose a concrete rewrite for that section
3. Wait for confirmation before moving on

Do not bundle multiple gaps into a single message. The user is reviewing each section; bundling defeats the loop.

For ACs (which are typically the 2-point criterion in the shipped rubric), prefer BDD scenarios when the behaviour is easiest to verify as user-facing. Numbered criteria are acceptable for infrastructure, refactors, and technical debt, but each item must still be independently testable.

Reject vague criteria in the user's proposed text: `it should work`, `improve performance` without a target, `make it better`. Push back with the testable version before accepting.

**Enrichment criteria (soft gates):** The four spec-artifact criteria (`architecture-drawn`, `interfaces-defined`, `state-transitions`, `invariants-specified`) are handled differently. They are checked when score is below threshold, but the user may skip any with a reason. For each:

1. State the failing criterion and suggest what to add (e.g. a mermaid diagram, a state table, interface signatures)
2. Accept a deliberate skip: "This is a config change — no architecture to draw." or "Pure stateless function — no state transitions."
3. Do not push back on a reasoned skip. These are soft gates; the reason is what matters, not the artifact.

If the score reaches `threshold` without fixing enrichment criteria (i.e. the user skipped all four with valid reasons), proceed to the handoff — do not loop further.

### Step 5 — Branch on issue type

The description template depends on the issue type. Read the ticket's `issuetype.name` and use the matching template below.

**Bug** — steps to reproduce, expected behaviour, actual behaviour, environment, and any relevant error messages

**Story** — user goal, business context, and constraints the solution must satisfy

**Tech debt / Task** — current state, desired state, and why this matters now

**Investigation / Spike** — the question being answered, the systems/logs/code paths to inspect, and the decision or next step the findings must inform

If the type is missing or unclear, ask the user to confirm before proceeding.

### Step 6 — Components

Ensure at least one Jira component is set. If none is, prompt for the affected service or code area and pick the closest component from the project's existing list, or create a new one if the project allows it.

### Step 7 — Retarget if direction changed

If the refinement loop pivoted away from an earlier implementation (e.g. user rejected a proposed approach and chose a different one), rewrite the live ticket around the chosen path only:

- Remove rejected-tool comparisons and abandoned-solution history from the main ticket body
- Refresh `What needs to change`, `Acceptance criteria`, and `Out of scope` so they all describe the same chosen path
- Keep only the reasoning that still affects implementation, validation, or rollout
- If a previous `## Tech notes` section exists and reflects the rejected direction, mark it stale in Step 8 (do not delete; the post-back in Step 8 will overwrite it)

This keeps the ticket readable for a delivery engineer who was not in the earlier discussion and gives the downstream agent a clean source text.

### Step 8 — Rewrite inline + hand off to Plan agent

This is a single combined step: rewrite the ticket, then plan it.

**8a — Rewrite.** Rewrite the live Jira ticket — summary and description — so the agent has the full context it needs without referring to anything outside the ticket. Update via the Atlassian MCP `editIssue` tool. Preserve the existing issue type, components, and labels unless the refinement loop explicitly changed them.

**Writing rules:**

- Start with the problem people can observe: what is awkward, risky, broken, or slow today?
- Explain harness or agent terms once in normal language before using jargon
- Separate the reason for the work from the proposed mechanism
- Use short headings: `Problem`, `Why it matters`, `What needs to change`, `Acceptance criteria`, `Out of scope`, and (where it helps) `Notes for agent`
- Avoid formal filler such as `This initiative aims to`, `leverage`, `facilitate`, or `ensure robustness` unless followed by a concrete behaviour
- Plain English is not a licence to be vague — ACs still need to be precise and testable

**8b — Hand off to the Plan agent.** After the rewrite is posted, hand off to VS Code's built-in **Plan** agent in the same session:

- Provide the ticket key, URL, current summary, full description (post-rewrite), and the rubric (so the plan agent respects DoR constraints)
- Explicitly tell the Plan agent: "Produce an implementation plan for this ticket. Include a `Summary`, `Implementation steps`, and `Verification steps` section. Where applicable, the plan should signal the architecture (components and their connections), interfaces (public surfaces between components), state transitions (stateful flows), and invariants (constraints that must hold). The plan will be posted back into the ticket as `## Tech notes` — write it as a single markdown block, not as a multi-turn conversation."
- If you are not in a session that supports `/plan`, stop here and instruct the user to run `/plan` themselves, pasting the ticket key/URL/summary, and to return to this skill with the plan output for Step 8c.

The Plan agent writes its output to `/memories/session/plan.md` by default — that is a per-session scratch path which is cleared at session end. Do not rely on it as durable storage; the durable record is Step 8c.

**8c — Post tech notes back to the ticket.** Read the Plan agent's output (either from `/memories/session/plan.md` if accessible, or by capturing its in-session reply) and update the ticket description with a managed `## Tech notes` section:

```
... existing description content ...

## Tech notes

<full plan output here — Summary, Implementation steps, Verification steps>
```

**Idempotency contract for `## Tech notes`:**

- If the description already contains a `## Tech notes` section (delimited by `## Tech notes` … either the next `## ` heading or end of document), **replace its contents** with the new plan output. Do not append a second `## Tech notes` section.
- If no `## Tech notes` section exists, **append it** at the end of the description.
- Preserve all content above the section unchanged.
- Do not add or modify any other headings as part of this step.

Use the Atlassian MCP `editIssue` tool with the full new description (existing content + replaced/added `## Tech notes` block). Use the wiki-markdown or ADF representation as appropriate for the MCP server; convert markdown headings, lists, and code blocks faithfully.

If the previous `## Tech notes` section was marked stale in Step 7, mention this in the post: include a single line `> Supersedes plan from <previous version/timestamp>.` immediately under the new `## Tech notes` heading before the plan content.

### Step 9 — Re-score and report

After the rewrite + plan post-back, re-score against the rubric. Report:

- New score and bucket
- Which criteria moved from fail to pass
- Whether `## Tech notes` was added, replaced, or skipped (and the previous version/timestamp if replaced)
- The final ticket URL
- Whether the ticket is now ready for the downstream agent / implementer

If the score is still below `threshold`, surface the remaining gaps and ask whether to continue the loop or stop. Do not run the Plan agent again until the description passes.

## Storage and cleanup

- `/memories/session/plan.md` is per-session and auto-cleared when the conversation ends. No cleanup is needed and no `.gitignore` entry is required.
- The durable record of the plan is the `## Tech notes` section in the ticket description (Step 8c). Do not duplicate the plan to a repo file or to a local scratch path; the ticket is the single source of truth.
- If the user wants a local copy of the plan for offline reference, they can capture it from the Plan agent's reply before session end — that is a user choice, not a skill responsibility.

## Verification

Before reporting completion, confirm:

- [ ] `references/refine-rubric.yml` (shipped with this skill) was found and validated (criteria non-empty, `points` sum to `maxScore`, `threshold <= maxScore`)
- [ ] Ticket was fetched and its current state captured before any rewrite (including any existing `## Tech notes` section)
- [ ] Issue type was identified and the matching description template was used
- [ ] All rubric criteria were scored (sum to a value in `0..maxScore`)
- [ ] If score was below `threshold`, the refinement loop ran one question at a time
- [ ] Vague ACs (`it should work`, `make it better`) were rejected, not accepted
- [ ] Enrichment criteria are either filled or deliberately skipped with a written reason
- [ ] At least one Jira component is set
- [ ] The rewritten ticket uses short headings and avoids the banned filler phrases
- [ ] If direction changed during refinement, rejected-tool history was scrubbed
- [ ] The Plan agent was invoked with the post-rewrite ticket as context and explicit instructions to produce a single markdown block
- [ ] The `## Tech notes` section was updated idempotently (replaced if existing, appended if not); no duplicate section created
- [ ] Re-score after rewrite is at least `threshold`

## Common pitfalls

- **Score a ticket as ready without actually fixing the gaps.** Rubric scoring is a gate, not a vibe. If a criterion fails, run the loop.
- **Skip enrichment criteria without a reason.** Soft gates means you *can* skip, not that you *should*. Push for a reason, not the artifact — a silent skip voids the warning and defeats the purpose.
- **Burn loop turns on enrichment before the hard criteria are fixed.** Fix the blocking gaps first (summary, ACs, scope). Enrichment is a polish step; don't sequence it ahead of substance.
- **Forbid the Plan agent from producing enrichment artifacts.** The enrichment criteria feed the `## Tech notes` section. When handing off to the Plan agent, mention architecture/interfaces/state/invariants as signals the plan should address where applicable.
- **Bundle multiple rubric gaps into one question.** One criterion per question; the user is reviewing section by section.
- **Accept vague ACs.** `it should work` is not an acceptance criterion. Push back with the testable version.
- **Skip the issue-type branch.** Bugs, stories, spikes, and tech-debt tickets all need different description shapes. Pick the right one.
- **Rewrite without fetching first.** Always read the current ticket. The rewrite must build on the existing context, not invent a new ticket.
- **Leave rejected-tool comparisons in the description.** Once the direction is chosen, scrub the abandoned history.
- **Invoke the Plan agent on an under-ready ticket.** The plan is wasted if the description still fails the rubric. Re-score first; only plan when the score is at or above `threshold`.
- **Append a second `## Tech notes` section.** Always replace an existing section; never duplicate. Two `## Tech notes` sections means a future iteration will only update the first.
- **Persist the plan outside Jira.** The ticket is the source of truth. Do not write `plan.md` to the repo or to `/memories` long-term.
- **Run `refine` while the ticket is `In Progress`.** The description is no longer yours to rewrite; ask the user to either move the ticket back to `To Do` or stop.

## Example — bug ticket before and after

The shape is identical for any ticket type; only the issue-type template and rubric criteria change.

**Before refinement (score: 2/12):**

> **Summary:** Fix HyperPay bug
>
> **Description:** HyperPay is failing sometimes. Need to fix it.

Score breakdown (criterion `id` → result):

- `summary-specific` — fail (`Fix HyperPay bug` does not name the failure)
- `description-rationale` — fail (no current state, no desired outcome)
- `ac-present` — fail (no AC section) — **0 of 2 points**
- `ac-testable` — fail (no AC section)
- `component-identified` — fail
- `scope-bounded` — partial (vague but bounded enough)
- `no-blockers` — fail (no info to judge)
- `architecture-drawn` — fail (no diagram, no component map)
- `interfaces-defined` — fail (no interface or event schema)
- `state-transitions` — fail (no state enumeration)
- `invariants-specified` — fail (no invariants)

**After refinement (score: 7/12 — enrichment all skipped with valid reasons, then Plan agent run, `## Tech notes` appended):**

> **Summary:** HyperPay redirect fails silently when 3DS challenge is cancelled by user
>
> **Description:**
>
> **Problem**
> When a member cancels the 3DS challenge mid-flow, the HyperPay redirect returns to the success URL but the payment is never captured. The member sees a confirmation screen for a payment that did not go through.
>
> **Why it matters**
> Failed payments are reconciled as successful, which inflates revenue reporting and triggers chargebacks when the member's card is later charged.
>
> **What needs to change**
> In `payments-hyperpay-adapter`, treat a cancelled 3DS challenge as a terminal failure: do not post the redirect to the success handler, surface a `payment_failed` event instead.
>
> **Acceptance criteria**
>
> - Given a member cancels the 3DS challenge, when the redirect returns, then the success handler is not invoked
> - Given a member cancels the 3DS challenge, when the redirect returns, then a `payment_failed` event is emitted with reason `3ds_cancelled`
> - Given a member completes 3DS successfully, when the redirect returns, then the success handler runs and a `payment_captured` event is emitted
>
> **Out of scope**
> Webhook-driven cancellations, refund flow, retry logic.
>
> **Notes for agent**
> The cancellation signal is `payment_status=cancelled` in the HyperPay redirect query string. The current code in `HyperPayAdapter.handleRedirect` always treats the redirect as success.
>
> Components: `payments-hyperpay-adapter`
>
> ## Tech notes
>
> ### Summary
> Branch off `HyperPayAdapter.handleRedirect`. Replace the unconditional success branch with a status switch on the redirect's `payment_status`. Emit `payment_failed` (reason `3ds_cancelled`) when cancelled; emit `payment_captured` when status is `success`. All other statuses fall through to `payment_failed` with the upstream reason.
>
> ### Implementation steps
> 1. Add `payment_status` parsing to `HyperPayAdapter.handleRedirect`.
> 2. Replace the unconditional `successHandler` invocation with a switch on `payment_status`.
> 3. Emit the appropriate event (`payment_captured` / `payment_failed`) with the relevant reason.
> 4. Cover the new branches with unit tests in `hyperpay-adapter.test.ts`.
>
> ### Verification steps
> - `npm test -- hyperpay-adapter` passes with new test cases for `cancelled` and `success`.
> - Manual: cancel a 3DS challenge in staging; confirm `payment_failed` event fires and the success screen is not shown.
> - Manual: complete a 3DS challenge; confirm `payment_captured` event fires and the success screen is shown.

Score breakdown after rewrite:

- Original criteria: all pass (7 of 7 possible)
- Enrichment criteria: all skipped with reasons — `architecture-drawn` skipped ("contained single-method change"), `interfaces-defined` skipped ("existing interface unchanged"), `state-transitions` skipped ("branching logic, not state"), `invariants-specified` skipped ("trivial enough")

→ **7/12, ready (at threshold)**, plan posted.

## The bottom line

You are a referee, not an author. Load the rubric, score the ticket, run the loop if it fails, rewrite the live ticket when the loop lands, hand off to the Plan agent, post the tech notes back into the description idempotently, re-score, and report. The downstream agent reads the ticket, not the conversation.
