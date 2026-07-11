# pi-lavish

Pi package for Lavish browser review sessions.

It bundles a Pi extension and a Lavish skill.

## What it provides

- `lavish_review` tool for opening a review session, showing the URL, and polling for feedback.
- `lavish_reference` tool for Lavish design guidance and playbooks.
- `lavish_end` tool for ending a review session.
- `lavish_export` tool for writing a portable local HTML copy.
- `/skill:lavish` guidance for the model.
- A Pi status item while Lavish is active.
- A Pi widget that keeps the Lavish URL visible while the tool waits for browser feedback.
- `/lavish-clear` to clear the status widget.

## Requirements

Node.js 22 or newer is required.

The package includes an exact `lavish-axi 0.1.40` runtime dependency and invokes its CLI directly with these default settings:

- `LAVISH_AXI_HOST=127.0.0.1`
- `LAVISH_AXI_PORT=4387`
- `LAVISH_AXI_STATE_DIR=$HOME/.lavish-axi`
- `LAVISH_AXI_NO_OPEN=1`
- `LAVISH_AXI_TELEMETRY=off`

If `LAVISH_AXI_LINK_HOST` is unset, the extension tries to discover a Tailscale DNS name with `tailscale status --json`.
If Tailscale is unavailable, it leaves the link host unset.
Tailscale is optional.

Environment variables can override these defaults.
Keep `LAVISH_AXI_HOST=127.0.0.1` unless the review server is intentionally exposed on a trusted network.

## Install locally

```bash
pi install /home/syzom/projects/pi-extensions/pi-lavish
```

For one-off testing:

```bash
pi -e /home/syzom/projects/pi-extensions/pi-lavish
```

## Install from GitHub

```bash
pi install git:github.com/Vistyy/pi-lavish@v0.3.1
```

## Package layout

```text
pi-lavish/
  package.json
  extensions/
    pi-lavish/
      index.ts
      paths.ts
      protocol.ts
      runner.ts
      schemas.ts
      truncate.ts
      sessions.ts
      ui.ts
      tools/
        end.ts
        export.ts
        reference.ts
        review.ts
  skills/
    lavish/
      SKILL.md
```

The extension owns runtime behavior.

The skill tells the model when and how to use the tools.

## Tool workflow

First call:

```text
lavish_review(file: "path/to/file", initialReply: "What to review first")
```

The tool runs Lavish AXI internally, extracts the URL, displays it in Pi, then polls for feedback.

Follow-up call:

```text
lavish_review(file: "path/to/file", agentReply: "Reply to the browser reviewer")
```

The tool sends the reply and waits for the next feedback.

A browser-ended session stays ended.
Reopen it only when further visual review is explicitly warranted:

```text
lavish_review(file: "path/to/file", reopen: true)
```

Pi restores recorded active-session URLs after reload.
The next `lavish_review` call verifies and resumes the session without starting hidden background polling.

End the session:

```text
lavish_end(file: "path/to/file")
```

Export a portable local copy:

```text
lavish_export(file: "path/to/file", out: "dist/artifact.html")
```

## Development

Install dependencies if you want local type checking:

```bash
pnpm install
pnpm run check
```

Pi loads TypeScript extensions directly, so a build step is not required.
