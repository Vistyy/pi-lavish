# pi-lavish

Pi package for Lavish browser review sessions.

It bundles a Pi extension and a Lavish skill.

## What it provides

- `lavish_review` tool for the agent.
- `/skill:lavish` guidance for the model.
- A Pi status item while Lavish is active.
- A Pi widget that keeps the Lavish URL visible while the tool waits for browser feedback.
- `/lavish-clear` to clear the status widget.

## Requirements

The `lavish` command must be available on `PATH`.

On the devbox, this should be the local wrapper that binds to localhost and uses the expected Lavish AXI setup.

## Install locally

```bash
pi install /home/syzom/projects/pi-extensions/pi-lavish
```

For one-off testing:

```bash
pi -e /home/syzom/projects/pi-extensions/pi-lavish
```

## Package layout

```text
pi-lavish/
  package.json
  extensions/
    index.ts
  skills/
    lavish/
      SKILL.md
```

The extension owns runtime behavior.

The skill only tells the model when and how to use the tool.

## Tool workflow

First call:

```text
lavish_review(file: "path/to/file")
```

The tool runs `lavish <file>`, extracts the URL, displays it in Pi, then runs `lavish poll <file>`.

Follow-up call:

```text
lavish_review(file: "path/to/file", agentReply: "Reply to the browser reviewer")
```

The tool runs `lavish poll <file> --agent-reply <reply>` and waits for the next feedback.

## Development

Install dependencies if you want local type checking:

```bash
npm install
npm run typecheck
```

Pi loads TypeScript extensions directly, so a build step is not required.
