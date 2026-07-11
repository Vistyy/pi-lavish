import assert from "node:assert/strict";
import { test } from "node:test";
import { truncateFeedback } from "../extensions/pi-lavish/truncate.js";

test("truncated feedback retains the authoritative next step", async () => {
	const largeSnapshot = Array.from({ length: 10_000 }, (_, index) => `snapshot line ${index}`).join("\n");
	const feedback = `session:\n  status: feedback\ndom_snapshot: |\n${largeSnapshot}\nnext_step: "Stop polling because the user ended this session."`;

	const result = await truncateFeedback(feedback);
	assert.equal(result.truncated, true);
	assert.match(result.content, /next_step: "Stop polling because the user ended this session\."/);
});
