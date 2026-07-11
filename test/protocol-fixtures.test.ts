import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { inspectLavishProtocol, translateLavishProtocolForPi } from "../extensions/pi-lavish/protocol.js";

const fixtureUrl = (name: string) => new URL(`./fixtures/lavish-0.1.40/${name}`, import.meta.url);
const artifact = "/tmp/lavish-fixture/review.html";

test("captured 0.1.40 layout warning retains typed severity and guidance", async () => {
	const output = await readFile(fixtureUrl("layout-warning.toon"), "utf8");
	const summary = inspectLavishProtocol(output);
	assert.deepEqual(summary.layoutWarnings, [
		{
			selector: "main > h1",
			kind: "clipped-text",
			overflowPx: 8,
			viewportWidth: 1341,
			severity: "error",
			persistent: false,
		},
	]);
	assert.match(translateLavishProtocolForPi(output, { file: artifact }), /lavish_review/);
});

test("captured 0.1.40 Send & End is terminal while retaining final feedback", async () => {
	const output = await readFile(fixtureUrl("send-and-end.toon"), "utf8");
	const summary = inspectLavishProtocol(output);
	assert.equal(summary.sessionEnded, true);
	assert.equal(summary.endedBy, "user");
	assert.match(output, /Ship it/);
});

test("captured 0.1.40 whiteboard target exposes local scene and preview paths", async () => {
	const output = await readFile(fixtureUrl("whiteboard-feedback.toon"), "utf8");
	assert.deepEqual(inspectLavishProtocol(output).whiteboards, [
		{
			scenePath: "/tmp/lavish-fixture/scene.excalidraw",
			previewPath: "/tmp/lavish-fixture/scene.png",
		},
	]);
});
