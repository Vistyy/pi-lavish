---
name: lavish
description: Turn complex or visual agent responses into rich, reviewable HTML artifacts the user can annotate and send feedback on, using the local lavish wrapper or the Pi lavish_review tool when available. Use when about to give a plan, comparison, diagram, table, code diff, report, or anything easier to grasp visually than as prose.
argument-hint: <what the artifact should show>
author: Kun Chen (kunchenguid)
metadata:
  hermes:
    tags: [html, review, artifacts, visualization]
    category: productivity
---

# Lavish Editor

Lavish Editor helps agents turn rich HTML artifacts into collaborative human review surfaces.
Whenever you are about to give the user a complex response that will be easier to understand via a rich or interactive page, consider using Lavish Editor.
First generate an interactive HTML artifact according to the user request, then use the preferred Pi workflow or the fallback shell workflow below so the user can visually review it, annotate elements or selected text, queue prompts, and send feedback.

Use the local `lavish` wrapper for fallback shell commands.
It sets safe devbox defaults, keeps Lavish bound to loopback, disables browser auto-open and telemetry, uses shared per-user state for the single devbox server, and invokes `lavish-axi`.
If output shows a follow-up command starting with `lavish-axi`, run the equivalent command through `lavish` instead.
For example, run `lavish poll <html-file>` instead of `lavish-axi poll <html-file>`.

## Request

$ARGUMENTS

If the request above is non-empty, the user invoked `/lavish` explicitly.
Build an HTML artifact for that request now, following the workflow below.
If it is empty, infer what to visualize from the conversation.

## When to use

Use Lavish when the user asks for a visual artifact, HTML explainer, interactive prototype, review surface, product or technical plan, comparison, report, or browser-based feedback loop.

## Preferred Pi workflow

When the `lavish_review` tool is available, use it instead of raw shell Lavish commands.
The tool opens or resumes the Lavish session, displays the URL in Pi, and waits for browser feedback.

1. Create the HTML artifact in a unique path, usually `.lavish/reviews/<task-id>.html` in the working directory.
2. Call `lavish_review(file: "<html-file>")`.
3. Wait for the tool to return feedback, an end signal, or browser-reported `layout_warnings`.
4. If the tool returns `layout_warnings`, fix overflow, clipped text, or overlapping unreadable content and re-check before involving the human.
5. Apply human feedback, then call `lavish_review(file: "<html-file>", agentReply: "<message>")` to reply in the browser and wait for the next response.
6. Repeat until the browser reviewer is satisfied or the user asks you to stop.
7. Run `lavish end <html-file>` when the review is finished.

Do not final-answer while Lavish is waiting.
Do not use raw shell Lavish commands when `lavish_review` is available.

## Fallback shell workflow

Use this only when the `lavish_review` tool is unavailable.

1. Create the HTML artifact in a unique path, usually `.lavish/reviews/<task-id>.html` in the working directory.
2. Run `lavish <html-file>` to open or resume a review session in the browser.
3. Immediately run `lavish poll <html-file>` in the foreground.
   This is mandatory.
   Do not stop after opening the session.
   Do not send a final response that only contains the URL.
   The poll is the bridge between the browser chat and the agent.
   Without an active poll, the browser will show `Your agent is not listening` and user feedback will just sit in the queue.
4. Keep the foreground poll running until it returns feedback, an end signal, or browser-reported `layout_warnings`.
   The poll stays silent while waiting.
   That is normal.
   Leave it running and never kill it.
   Do not background the poll in Pi unless you also have a reliable way to watch its output and resume work when it exits.
5. If poll returns `layout_warnings`, fix overflow, clipped text, or overlapping unreadable content and re-check before involving the human.
6. Apply human feedback, then immediately poll again with `--agent-reply "<message>"` to reply in the browser and keep the loop going.
7. Run `lavish end <html-file>` when the review is finished.

## Visual guidance

- Use visual hierarchy to make the most important decisions, risks, tradeoffs, and next actions obvious at a glance.
- Use visual structure such as sections, cards, tables, diagrams, annotated snippets, and side-by-side comparisons instead of long prose.
- Choose typography, spacing, color, and layout deliberately so the artifact has a clear point of view.
- Prevent horizontal overflow at every nesting level.
- Nested grid and flex children also need `minmax(0, 1fr)` tracks and `min-width: 0`, especially when badges, labels, or status text use wide pixel or monospace fonts.
- Wrap, truncate, or contain long unbreakable text deliberately.

## Playbooks

Run `lavish playbook <id>` for focused, detailed guidance on any of these.
One artifact often combines several playbooks, for example a plan that includes a comparison and a diagram.
You MUST open each matching playbook before writing HTML.
For flows, architecture, state, or sequence diagrams, do not hand-build boxes-and-arrows from div or flexbox.
Open the diagram playbook and use Mermaid unless SVG is needed for richly annotated nodes.

- `diagram` - Map relationships, flows, state, and architecture.
- `table` - Turn dense records into scan-friendly review surfaces.
- `comparison` - Show options, tradeoffs, and current vs target behavior.
- `plan` - Explain a product or technical plan before implementation.
- `code` - Render source code, code files, patches, PR diffs, and before/after code inside Lavish artifacts.
- `input` - Must be used when the agent needs to collect user input on decisions, choices, preferences, triage, scope, or other structured feedback from within the artifact.
- `slides` - Create a deliberate presentation when slides are requested.

## Commands and rules

- Prefer `lavish_review` when it is available in Pi.
- Run `lavish <html-file>` to open or resume a Lavish Editor session only when `lavish_review` is unavailable or unsuitable.
- Unless the user specifies another location, create HTML artifacts in the current working directory under `.lavish/reviews/` with a unique task-specific filename.
- Lavish serves the HTML file through a local Express.js server.
- If your HTML needs to reference other filesystem assets such as images, CSS, fonts, and local scripts, copy them into the same directory as the HTML file, then reference them with relative paths from that directory.
- Never prepend `/` to those asset paths because root paths will not work.
- After every fallback `lavish <html-file>` open command, immediately run `lavish poll <html-file>`.
- Do not answer the user with only the session URL and then stop.
- Run fallback `lavish poll <html-file>` in the foreground to wait for user feedback or browser-reported `layout_warnings`.
- It long-polls and stays silent until the user sends feedback, ends the session, or the real browser reports fresh `layout_warnings`, so leave it running and never kill it.
- Fix `layout_warnings` before involving the human.
- Do not background the fallback poll in Pi unless you also have a reliable way to watch its output and resume work when it exits.
- If the fallback poll gets killed or times out, just re-run it.
- Queued feedback is never lost.
- Run `lavish end <html-file>` to end a session.
- Run `lavish stop` to shut down the background server.
- The server also self-stops when idle or after the last session ends with nothing connected.
- Run `lavish playbook <playbook_id>` for focused artifact guidance.
- Run `lavish design` for the default content-to-playbook router, Tailwind CSS browser runtime v4 plus DaisyUI v5 CDN snippet, Mermaid CDN snippet and init, and DaisyUI component reference.
- Lavish does not auto-inject any design system.
- Artifacts stay portable so they render identically when opened directly without Lavish running.
- Before writing any HTML, decide the design direction in this strict priority order.
- First, if the user asked for a specific look or named design system, use that.
- Second, otherwise inspect the project the artifact is about and match that project's design system.
- The subject or product whose content or UI the artifact represents may differ from your current working directory.
- Look for Tailwind or theme config, shared CSS variables or design tokens, component libraries, brand assets, or existing styled pages.
- If the artifact previews, proposes, or mocks a specific app's UI, render it in that app's own design system so it faithfully shows the product.
- Third, only when both steps come up empty, use the Lavish-recommended Tailwind CSS browser runtime v4 plus DaisyUI v5 via CDN.
- Prefer the Tailwind and DaisyUI CDN snippet over hand-writing styles unless explicitly instructed otherwise by the user.
- When you deliver the artifact, state which of the three design sources you used and why.
- Use Lavish when the user asks for a visual artifact, HTML explainer, interactive prototype, review surface, product or technical plan, comparison, report, or browser-based feedback loop.
