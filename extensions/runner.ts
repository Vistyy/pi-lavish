import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export interface LavishCommandResult {
	stdout: string;
	stderr: string;
	code: number;
}

function defaultEnv(name: string, value: string): string {
	const current = process.env[name];
	return current && current.length > 0 ? current : value;
}

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<LavishCommandResult> {
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
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (!exited) child.kill("SIGKILL");
			}, 5000);
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

async function discoverTailscaleLinkHost(signal?: AbortSignal): Promise<string | undefined> {
	try {
		const result = await runCommand("tailscale", ["status", "--json"], process.env, signal);
		if (result.code !== 0) return undefined;

		const parsed = JSON.parse(result.stdout) as { Self?: { DNSName?: unknown } };
		const dnsName = parsed.Self?.DNSName;
		if (typeof dnsName !== "string") return undefined;

		const cleaned = dnsName.trim().replace(/[.]+$/, "");
		return cleaned || undefined;
	} catch {
		return undefined;
	}
}

async function buildLavishEnv(signal?: AbortSignal): Promise<NodeJS.ProcessEnv> {
	const env: NodeJS.ProcessEnv = {
		...process.env,
		LAVISH_AXI_HOST: defaultEnv("LAVISH_AXI_HOST", "127.0.0.1"),
		LAVISH_AXI_PORT: defaultEnv("LAVISH_AXI_PORT", "4387"),
		LAVISH_AXI_STATE_DIR: defaultEnv("LAVISH_AXI_STATE_DIR", join(homedir(), ".lavish-axi")),
		LAVISH_AXI_NO_OPEN: defaultEnv("LAVISH_AXI_NO_OPEN", "1"),
		LAVISH_AXI_TELEMETRY: defaultEnv("LAVISH_AXI_TELEMETRY", "off"),
	};

	const explicitLinkHost = process.env.LAVISH_AXI_LINK_HOST?.trim();
	const discoveredLinkHost = explicitLinkHost || (await discoverTailscaleLinkHost(signal));
	if (discoveredLinkHost) {
		env.LAVISH_AXI_LINK_HOST = discoveredLinkHost;
	}

	return env;
}

export async function runLavishAxi(args: string[], signal?: AbortSignal): Promise<LavishCommandResult> {
	const env = await buildLavishEnv(signal);
	try {
		return await runCommand("pnpm", ["dlx", "lavish-axi", ...args], env, signal);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			stdout: "",
			stderr: `Failed to start pnpm dlx lavish-axi. Ensure pnpm is installed and on PATH. ${message}`,
			code: 127,
		};
	}
}

export function commandForDisplay(args: string[]): string {
	return ["pnpm", "dlx", "lavish-axi", ...args]
		.map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg))
		.join(" ");
}

export function combinedOutput(result: { stdout?: string; stderr?: string }): string {
	return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}
