import assert from "node:assert/strict";
import { test } from "node:test";
import { commandForDisplay, defaultLavishRunner } from "../extensions/pi-lavish/runner.js";

test("the bundled exact Lavish CLI is available without pnpm dlx", async () => {
	const result = await defaultLavishRunner.run(["--version"]);
	assert.equal(result.code, 0, result.stderr);
	assert.equal(result.stdout.trim(), "0.1.40");
	assert.equal(commandForDisplay(["--version"]).startsWith(process.execPath), true);
	assert.doesNotMatch(commandForDisplay(["--version"]), / dlx /);
	assert.match(commandForDisplay(["--version"]), /lavish-axi.*dist.*cli\.mjs/);
});
