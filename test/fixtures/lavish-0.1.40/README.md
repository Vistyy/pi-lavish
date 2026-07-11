# Lavish 0.1.40 protocol fixtures

These fixtures were captured from the bundled `lavish-axi@0.1.40` CLI on 2026-07-11.

The source package has git head `f171ebfe2a6a0c8270b16906811a7fd50ca2ba8b`.

The capture opened a temporary artifact with `LAVISH_AXI_NO_OPEN=1`, submitted browser-equivalent feedback through Lavish's local HTTP endpoints, and invoked `lavish-axi poll`.

Temporary directories were normalized to `/tmp/lavish-fixture`.
Long `next_step` prose was shortened only where its semantic branch and command form remain intact.

- `layout-warning.toon` came from `/api/:key/layout-warnings` followed by `lavish-axi poll`.
- `send-and-end.toon` came from `/api/:key/prompts` with `endSession: true` followed by `lavish-axi poll`.
- `whiteboard-feedback.toon` came from a whiteboard prompt with an `excalidraw-scene` target followed by `lavish-axi poll`.
