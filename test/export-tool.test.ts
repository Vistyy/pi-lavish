import assert from "node:assert/strict";
import { test } from "node:test";
import { registerExportTool } from "../extensions/pi-lavish/tools/export.js";
import { createToolHarness } from "./helpers.js";

test("portable export preserves unresolved asset warnings", async () => {
	const harness = createToolHarness([
		{
			stdout: `export:\n  file: "/project/review.html"\n  output: "/project/dist/review.html"\n  status: exported\nunresolved_local_assets[1]:\n  "missing.png"\nnext_step: "Review unresolved local assets before sharing the export."`,
		},
	]);
	registerExportTool(harness.pi, harness.runner);
	const tool = harness.getTool();

	const result = await tool.execute(
		"call-1",
		{ file: "review.html", out: "dist/review.html" },
		undefined,
		undefined,
		{ cwd: "/project", hasUI: false },
	);

	assert.deepEqual(harness.calls, [["export", "/project/review.html", "--out", "/project/dist/review.html"]]);
	assert.equal(result.details.outputFile, "/project/dist/review.html");
	assert.match(result.content[0].text, /missing\.png/);
	assert.match(result.content[0].text, /Review unresolved local assets/);
});
