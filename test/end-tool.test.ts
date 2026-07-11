import assert from "node:assert/strict";
import { test } from "node:test";
import { getReviewUrl, rememberReviewUrl } from "../extensions/pi-lavish/sessions.js";
import { registerEndTool } from "../extensions/pi-lavish/tools/end.js";
import { createToolHarness } from "./helpers.js";

test("agent end clears local state and records a normally reopenable end", async () => {
	const harness = createToolHarness([
		{ stdout: `session:\n  file: "/project/review.html"\n  status: ended\n  ended_by: agent` },
	]);
	registerEndTool(harness.pi, harness.runner);
	const tool = harness.getTool();
	rememberReviewUrl("/project/review.html", "http://local/session");

	const result = await tool.execute(
		"call-1",
		{ file: "review.html" },
		undefined,
		undefined,
		{ cwd: "/project", hasUI: false },
	);

	assert.deepEqual(harness.calls, [["end", "/project/review.html"]]);
	assert.equal(getReviewUrl("/project/review.html"), undefined);
	assert.match(result.content[0].text, /ended_by: agent/);
	assert.deepEqual(harness.entries.at(-1), {
		type: "pi-lavish-session",
		data: { version: 1, absoluteFile: "/project/review.html", file: "review.html", state: "ended" },
	});
});
