---
name: lavish
description: Turn complex or visual agent responses into rich, reviewable HTML artifacts the user can annotate and send feedback on through the Pi Lavish tools. Use when about to give a plan, comparison, diagram, table, code diff, report, or anything easier to grasp visually than as prose.
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
First generate an interactive HTML artifact according to the user request, then use the Pi Lavish tools so the user can visually review it, annotate elements or selected text, queue prompts, and send feedback.

## Request

$ARGUMENTS

If the request above is non-empty, the user invoked `/lavish` explicitly.
Build an HTML artifact for that request now, following the workflow below.
If it is empty, infer what to visualize from the conversation.

## When to use

Use Lavish when the user asks for a visual artifact, HTML explainer, interactive prototype, review surface, product or technical plan, comparison, report, or browser-based feedback loop.

## Pi workflow

Use the Pi Lavish tools.
Do not use raw shell Lavish commands when the tools are available.

1. Create the HTML artifact in a unique path, usually `.lavish/reviews/<task-id>.html` in the working directory.
2. Call `lavish_review(file: "<html-file>")`.
3. Wait for the tool to return feedback, an end signal, or browser-reported `layout_warnings`.
4. If the tool returns `layout_warnings`, fix overflow, clipped text, or overlapping unreadable content and re-check before involving the human.
5. Apply human feedback, then call `lavish_review(file: "<html-file>", agentReply: "<message>")` to reply in the browser and wait for the next response.
6. Repeat until the browser reviewer is satisfied or the user asks you to stop.
7. Call `lavish_end(file: "<html-file>")` when the review is finished.

Do not final-answer while Lavish is waiting.
Do not answer the user with only the session URL and then stop.
The active `lavish_review` tool call is the bridge between the browser chat and the agent.

## Visual guidance

- Use visual hierarchy to make the most important decisions, risks, tradeoffs, and next actions obvious at a glance.
- Use visual structure such as sections, cards, tables, diagrams, annotated snippets, and side-by-side comparisons instead of long prose.
- Choose typography, spacing, color, and layout deliberately so the artifact has a clear point of view.
- Prevent horizontal overflow at every nesting level.
- Nested grid and flex children also need `minmax(0, 1fr)` tracks and `min-width: 0`, especially when badges, labels, or status text use wide pixel or monospace fonts.
- Wrap, truncate, or contain long unbreakable text deliberately.

## Playbooks

Use `lavish_reference(action: "playbook", playbookId: "<id>")` for focused, detailed guidance on any of these.
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

- Use `lavish_reference(action: "design")` for the default content-to-playbook router, Tailwind CSS browser runtime v4 plus DaisyUI v5 CDN snippet, Mermaid CDN snippet and init, and DaisyUI component reference.
- Unless the user specifies another location, create HTML artifacts in the current working directory under `.lavish/reviews/` with a unique task-specific filename.
- Lavish serves the HTML file through a local server managed by the Pi Lavish tools.
- If your HTML needs to reference other filesystem assets such as images, CSS, fonts, and local scripts, copy them into the same directory as the HTML file, then reference them with relative paths from that directory.
- Never prepend `/` to those asset paths because root paths will not work.
- Fix `layout_warnings` before involving the human.
- Queued feedback is never lost.
- Call `lavish_end(file: "<html-file>")` to end a session.
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
