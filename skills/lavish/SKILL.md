---
name: lavish
description: Use Lavish for browser-based human review of files, UI work, visual output, or generated artifacts. Prefer the pi lavish_review tool when available.
---

# Lavish

Use Lavish when the user wants browser-based review, visual inspection, or feedback from a browser session.

## Preferred Pi workflow

When the `lavish_review` tool is available, use it instead of shell commands.

First call:

```text
lavish_review(file: "path/to/file")
```

The tool opens the Lavish session, displays the URL in Pi, and waits for browser feedback.

After feedback arrives, answer it by calling the same tool with `agentReply`:

```text
lavish_review(file: "path/to/file", agentReply: "Your reply to the browser reviewer")
```

The tool sends the reply to Lavish and waits for the next browser feedback.

Repeat until the browser reviewer is satisfied or the user asks you to stop.

Do not final-answer while Lavish is waiting.

Do not use raw shell Lavish commands when `lavish_review` is available.

## Fallback shell workflow

Use this only when the `lavish_review` tool is unavailable.

Open a session:

```bash
lavish path/to/file
```

Then poll immediately:

```bash
lavish poll path/to/file
```

When you need to reply to the browser reviewer, send the reply and wait again:

```bash
lavish poll path/to/file --agent-reply "Your reply"
```

Keep polling after each reply until the review is complete.
