# pi-lavish

Pi package for Lavish browser review sessions.

It bundles a Pi extension and a Lavish skill.

## What it provides

- `lavish_review` tool for opening a review session, showing the URL, and polling for feedback.
- `lavish_reference` tool for Lavish design guidance and playbooks.
- `lavish_end` tool for ending a review session.
- `/skill:lavish` guidance for the model.
- A Pi status item while Lavish is active.
- A Pi widget that keeps the Lavish URL visible while the tool waits for browser feedback.
- `/lavish-clear` to clear the status widget.

## Requirements

`pnpm` must be available on `PATH`.

The extension invokes `pnpm dlx lavish-axi` internally with safe runtime defaults:

- `LAVISH_AXI_HOST=127.0.0.1`
- `LAVISH_AXI_PORT=4387`
- `LAVISH_AXI_STATE_DIR=$HOME/.lavish-axi`
- `LAVISH_AXI_NO_OPEN=1`
- `LAVISH_AXI_TELEMETRY=off`

If `LAVISH_AXI_LINK_HOST` is unset, the extension tries to discover a Tailscale DNS name with `tailscale status --json`.
If Tailscale is unavailable, it leaves the link host unset.
Tailscale is optional.

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
pi install git:github.com/Vistyy/pi-lavish@v0.2.1
```

## Package layout

```text
pi-lavish/
  package.json
  extensions/
    index.ts
    runner.ts
    schemas.ts
    truncate.ts
    sessions.ts
    ui.ts
    tools/
      end.ts
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
lavish_review(file: "path/to/file")
```

The tool runs Lavish AXI internally, extracts the URL, displays it in Pi, then polls for feedback.

Follow-up call:

```text
lavish_review(file: "path/to/file", agentReply: "Reply to the browser reviewer")
```

The tool sends the reply and waits for the next feedback.

End the session:

```text
lavish_end(file: "path/to/file")
```

## Development

Install dependencies if you want local type checking:

```bash
pnpm install
pnpm run typecheck
```

Pi loads TypeScript extensions directly, so a build step is not required.
