import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import lavishExtension from "../extensions/pi-lavish/index.js";
import { getReviewUrl, restoreReviewSessions } from "../extensions/pi-lavish/sessions.js";

test("active-branch records restore the latest non-ended Lavish session", () => {
	const active = restoreReviewSessions([
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: { version: 1, absoluteFile: "/project/a.html", file: "a.html", url: "http://local/a", state: "waiting" },
		},
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: { version: 1, absoluteFile: "/project/a.html", file: "a.html", url: "http://local/a", state: "feedback" },
		},
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: { version: 1, absoluteFile: "/project/b.html", file: "b.html", url: "http://local/b", state: "ended" },
		},
	]);

	assert.equal(getReviewUrl("/project/a.html"), "http://local/a");
	assert.equal(getReviewUrl("/project/b.html"), undefined);
	assert.deepEqual(active, { absoluteFile: "/project/a.html", file: "a.html", url: "http://local/a", state: "feedback" });
});

test("an ended result removes an earlier waiting record", () => {
	const active = restoreReviewSessions([
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: { version: 1, absoluteFile: "/project/a.html", file: "a.html", url: "http://local/a", state: "waiting" },
		},
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: { version: 1, absoluteFile: "/project/a.html", file: "a.html", state: "ended" },
		},
	]);

	assert.equal(active, undefined);
	assert.equal(getReviewUrl("/project/a.html"), undefined);
});

test("session_start restores active-branch UI without starting a poll", async () => {
	const handlers = new Map<string, (...args: any[]) => unknown>();
	let status: string | undefined;
	let widget: string[] | undefined;
	const pi = {
		on(name: string, handler: (...args: any[]) => unknown) { handlers.set(name, handler); },
		registerCommand() {},
		registerTool() {},
	} as unknown as ExtensionAPI;
	lavishExtension(pi);
	const branch = [
		{
			type: "custom",
			customType: "pi-lavish-session",
			data: {
				version: 1,
				absoluteFile: "/project/review.html",
				file: "review.html",
				url: "http://local/session",
				state: "waiting",
			},
		},
	];
	const ctx = {
		hasUI: true,
		sessionManager: { getBranch: () => branch },
		ui: {
			theme: { fg: (_color: string, text: string) => text },
			setStatus: (_key: string, value: string | undefined) => { status = value; },
			setWidget: (_key: string, value: string[] | undefined) => { widget = value; },
		},
	};

	await handlers.get("session_start")?.({}, ctx);
	assert.equal(getReviewUrl("/project/review.html"), "http://local/session");
	assert.match(status ?? "", /waiting/);
	assert.ok(widget?.some((line) => line.includes("http://local/session")));
});
