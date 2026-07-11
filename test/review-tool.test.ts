import assert from "node:assert/strict";
import { test } from "node:test";
import { registerReviewTool } from "../extensions/pi-lavish/tools/review.js";
import { createToolHarness, type FakeLavishOutput } from "./helpers.js";

function registerWith(outputs: FakeLavishOutput[]) {
	const harness = createToolHarness(outputs);
	registerReviewTool(harness.pi, harness.runner);
	return { ...harness, tool: harness.getTool() };
}

const ctx = {
	cwd: "/project",
	hasUI: false,
} as any;

test("Send & End returns final feedback and a terminal tool state", async () => {
	const { tool, calls } = registerWith([
		{
			stdout: `session:\n  file: "/project/review.html"\n  url: "http://127.0.0.1:4387/session/abc"\n  status: opened`,
		},
		{
			stdout: `session:\n  file: "/project/review.html"\n  status: feedback\n  session_ended: true\n  ended_by: user\nprompts[1]{prompt,tag}:\n  "Ship it",message\nnext_step: "The user ended this session. Stop polling and do not reopen it uninvited."`,
			stderr: "[lavish-axi] Long-polling for feedback...",
		},
	]);

	const result = await tool.execute("call-1", { file: "review.html" }, undefined, undefined, ctx);
	assert.deepEqual(calls, [["/project/review.html"], ["poll", "/project/review.html"]]);
	assert.equal(result.details.state, "ended");
	assert.equal(result.details.sessionEnded, true);
	assert.equal(result.details.endedBy, "user");
	assert.match(result.content[0].text, /Ship it/);
	assert.match(result.content[0].text, /Stop polling and do not reopen/);
	assert.doesNotMatch(result.content[0].text, /Long-polling/);
});

test("a user-ended open response does not start another poll", async () => {
	const { tool, calls } = registerWith([
		{
			stdout: `session:\n  file: "/project/review.html"\n  status: user-ended\n  ended_by: user\nnext_step: "Do not reopen uninvited. Use \`lavish-axi /project/review.html --reopen\` only when warranted."`,
		},
	]);

	const result = await tool.execute("call-2", { file: "review.html" }, undefined, undefined, ctx);
	assert.deepEqual(calls, [["/project/review.html"]]);
	assert.equal(result.details.state, "ended");
	assert.match(result.content[0].text, /reopen: true/);
});

test("an initial reply opens first and is sent with the first poll", async () => {
	const { tool, calls } = registerWith([
		{ stdout: `session:\n  url: "http://127.0.0.1/session/abc"\n  status: opened` },
		{ stdout: `session:\n  status: feedback\nnext_step: "Continue when ready."` },
	]);

	await tool.execute("call-3", { file: "review.html", initialReply: "Check the lifecycle first." }, undefined, undefined, ctx);
	assert.deepEqual(calls, [
		["/project/review.html"],
		["poll", "/project/review.html", "--agent-reply", "Check the lifecycle first."],
	]);
});

test("a blank initialReply does not suppress a nonempty agentReply", async () => {
	const { tool, calls } = registerWith([
		{ stdout: `session:\n  url: "http://127.0.0.1/session/blank"\n  status: opened` },
		{ stdout: `session:\n  status: feedback\nnext_step: "Continue when ready."` },
	]);
	await tool.execute(
		"call-blank",
		{ file: "blank-review.html", initialReply: "   ", agentReply: "Use this context." },
		undefined,
		undefined,
		ctx,
	);
	assert.deepEqual(calls, [
		["/project/blank-review.html"],
		["poll", "/project/blank-review.html", "--agent-reply", "Use this context."],
	]);
});

test("initialReply enforces its one-line contract", async () => {
	const { tool, calls } = registerWith([]);
	await assert.rejects(
		tool.execute("call-invalid", { file: "review.html", initialReply: "First line\nsecond line" }, undefined, undefined, ctx),
		/initialReply must be one line/,
	);
	assert.deepEqual(calls, []);
});

test("explicit reopen is forwarded to Lavish before polling", async () => {
	const { tool, calls } = registerWith([
		{ stdout: `session:\n  url: "http://127.0.0.1/session/abc"\n  status: opened` },
		{ stdout: `session:\n  status: ended\n  ended_by: user\nnext_step: "Stop polling."` },
	]);

	await tool.execute("call-4", { file: "review.html", reopen: true }, undefined, undefined, ctx);
	assert.deepEqual(calls, [["/project/review.html", "--reopen"], ["poll", "/project/review.html"]]);
});
