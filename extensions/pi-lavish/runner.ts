import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface LavishCommandResult {
	stdout: string;
	stderr: string;
	code: number;
}

export interface LavishRunner {
	run(args: string[], signal?: AbortSignal): Promise<LavishCommandResult>;
	commandForDisplay(args: string[]): string;
}

const require = createRequire(import.meta.url);
const LAVISH_PACKAGE_PATH = require.resolve("lavish-axi/package.json");
const LAVISH_CLI_PATH = join(dirname(LAVISH_PACKAGE_PATH), "dist", "cli.mjs");
const TAILSCALE_TIMEOUT_MS = 1500;
const TAILSCALE_FAILURE_TTL_MS = 60_000;
let tailscaleLinkHostPromise: Promise<string | undefined> | undefined;
let tailscaleLinkHostRetryAt = 0;

function defaultEnv(name: string, value: string): string {
	const current = process.env[name];
	return current && current.length > 0 ? current : value;
}

function runCommand(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	signal?: AbortSignal,
	killGraceMs = 5000,
): Promise<LavishCommandResult> {
	if (signal?.aborted) {
		return Promise.resolve({ stdout: "", stderr: "Command cancelled before start.", code: 130 });
	}

	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;
		let exited = false;
		let killTimer: ReturnType<typeof setTimeout> | undefined;

		const abort = () => {
			if (exited) return;
			if (killGraceMs <= 0) {
				child.kill("SIGKILL");
				return;
			}
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (!exited) child.kill("SIGKILL");
			}, killGraceMs);
		};

		const cleanup = () => {
			if (killTimer) clearTimeout(killTimer);
			if (signal) signal.removeEventListener("abort", abort);
		};

		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr?.on("data", (chunk: string) => {
			stderr += chunk;
		});

		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			exited = true;
			cleanup();
			reject(error);
		});

		child.once("close", (code, childSignal) => {
			if (settled) return;
			settled = true;
			exited = true;
			cleanup();
			resolve({
				stdout,
				stderr,
				code: code ?? (childSignal ? 130 : 1),
			});
		});

		if (signal) signal.addEventListener("abort", abort, { once: true });
	});
}

async function discoverTailscaleLinkHost(parentSignal?: AbortSignal): Promise<string | undefined> {
	const controller = new AbortController();
	const abort = () => controller.abort();
	const timer = setTimeout(abort, TAILSCALE_TIMEOUT_MS);
	parentSignal?.addEventListener("abort", abort, { once: true });

	try {
		const result = await runCommand("tailscale", ["status", "--json"], process.env, controller.signal, 0);
		if (result.code !== 0) return undefined;

		const parsed = JSON.parse(result.stdout) as { Self?: { DNSName?: unknown } };
		const dnsName = parsed.Self?.DNSName;
		if (typeof dnsName !== "string") return undefined;

		const cleaned = dnsName.trim().replace(/[.]+$/, "");
		return cleaned || undefined;
	} catch {
		return undefined;
	} finally {
		clearTimeout(timer);
		parentSignal?.removeEventListener("abort", abort);
	}
}

async function getTailscaleLinkHost(signal?: AbortSignal): Promise<string | undefined> {
	if (Date.now() < tailscaleLinkHostRetryAt) return undefined;

	tailscaleLinkHostPromise ??= discoverTailscaleLinkHost(signal);
	const host = await tailscaleLinkHostPromise;
	if (!host) {
		tailscaleLinkHostPromise = undefined;
		tailscaleLinkHostRetryAt = Date.now() + TAILSCALE_FAILURE_TTL_MS;
	} else {
		tailscaleLinkHostRetryAt = 0;
	}
	return host;
}

function shouldDiscoverLinkHost(args: string[]): boolean {
	return args[0] !== "design" && args[0] !== "playbook";
}

async function buildLavishEnv(args: string[], signal?: AbortSignal): Promise<NodeJS.ProcessEnv> {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
		LAVISH_AXI_HOST: defaultEnv("LAVISH_AXI_HOST", "127.0.0.1"),
		LAVISH_AXI_PORT: defaultEnv("LAVISH_AXI_PORT", "4387"),
		LAVISH_AXI_STATE_DIR: defaultEnv("LAVISH_AXI_STATE_DIR", join(homedir(), ".lavish-axi")),
		LAVISH_AXI_NO_OPEN: defaultEnv("LAVISH_AXI_NO_OPEN", "1"),
		LAVISH_AXI_TELEMETRY: defaultEnv("LAVISH_AXI_TELEMETRY", "off"),
		NO_COLOR: "1",
		FORCE_COLOR: "0",
	};

	delete env.LAVISH_AXI_LINK_HOST;

	const explicitLinkHost = process.env.LAVISH_AXI_LINK_HOST?.trim();
	const discoveredLinkHost = explicitLinkHost || (shouldDiscoverLinkHost(args) ? await getTailscaleLinkHost(signal) : undefined);
	if (discoveredLinkHost) {
		env.LAVISH_AXI_LINK_HOST = discoveredLinkHost;
	}

	return env;
}

export async function runLavishAxi(args: string[], signal?: AbortSignal): Promise<LavishCommandResult> {
	const env = await buildLavishEnv(args, signal);
	try {
		return await runCommand(process.execPath, [LAVISH_CLI_PATH, ...args], env, signal);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			stdout: "",
			stderr: `Failed to start the bundled lavish-axi CLI with Node.js. ${message}`,
			code: 127,
		};
	}
}

export function commandForDisplay(args: string[]): string {
	return [process.execPath, LAVISH_CLI_PATH, ...args]
		.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg))
		.join(" ");
}

export const defaultLavishRunner: LavishRunner = {
	run: runLavishAxi,
	commandForDisplay,
};

export function lavishCommandError(
	runner: LavishRunner,
	args: string[],
	result: { stdout?: string; stderr?: string; code: number },
): Error {
	const sections = [
		`${runner.commandForDisplay(args)} failed with code ${result.code}.`,
		result.stdout ? `stdout:\n${result.stdout}` : undefined,
		result.stderr ? `stderr:\n${result.stderr}` : undefined,
	].filter((section): section is string => Boolean(section));
	return new Error(sections.join("\n"));
}

export async function runCheckedLavishCommand(
	runner: LavishRunner,
	args: string[],
	signal?: AbortSignal,
): Promise<LavishCommandResult> {
	const result = await runner.run(args, signal);
	if (result.code !== 0) throw lavishCommandError(runner, args, result);
	return result;
}
