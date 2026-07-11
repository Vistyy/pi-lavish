import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { test } from "node:test";
import { inspectLavishProtocol } from "../extensions/pi-lavish/protocol.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const cliPath = join(dirname(require.resolve("lavish-axi/package.json")), "dist", "cli.mjs");

async function availablePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	return port;
}

test("bundled 0.1.40 completes a browser-equivalent Send & End round trip", async () => {
	const work = await mkdtemp(join(tmpdir(), "pi-lavish-integration-"));
	const state = await mkdtemp(join(tmpdir(), "pi-lavish-state-"));
	const file = join(work, "review.html");
	const port = await availablePort();
	const env = {
		...process.env,
		LAVISH_AXI_HOST: "127.0.0.1",
		LAVISH_AXI_PORT: String(port),
		LAVISH_AXI_STATE_DIR: state,
		LAVISH_AXI_NO_OPEN: "1",
		LAVISH_AXI_TELEMETRY: "off",
		NO_COLOR: "1",
		FORCE_COLOR: "0",
	};

	try {
		await writeFile(file, "<!doctype html><html><body><h1>Review</h1></body></html>\n", "utf8");
		const opened = await execFileAsync(process.execPath, [cliPath, file], { env });
		const url = inspectLavishProtocol(opened.stdout).url;
		assert.ok(url);
		const key = new URL(url).pathname.split("/").at(-1);
		assert.ok(key);

		const response = await fetch(`http://127.0.0.1:${port}/api/${key}/prompts`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ prompts: [{ prompt: "Ship it", tag: "message" }], endSession: true }),
		});
		assert.equal(response.ok, true);

		const polled = await execFileAsync(process.execPath, [cliPath, "poll", file, "--timeout-ms", "2000"], { env });
		const summary = inspectLavishProtocol(polled.stdout);
		assert.equal(summary.sessionEnded, true);
		assert.equal(summary.endedBy, "user");
		assert.match(polled.stdout, /Ship it/);
	} finally {
		await rm(work, { recursive: true, force: true });
		await rm(state, { recursive: true, force: true });
	}
});
