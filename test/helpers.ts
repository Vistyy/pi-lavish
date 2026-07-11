import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { LavishRunner } from "../extensions/pi-lavish/runner.js";

export interface FakeLavishOutput {
	stdout: string;
	stderr?: string;
	code?: number;
}

export function createToolHarness(outputs: FakeLavishOutput[]) {
	let tool: any;
	const calls: string[][] = [];
	const entries: Array<{ type: string; data: unknown }> = [];
	const pi = {
		registerTool(candidate: unknown) {
			tool = candidate;
		},
		appendEntry(type: string, data: unknown) {
			entries.push({ type, data });
		},
	} as unknown as ExtensionAPI;
	const runner: LavishRunner = {
		async run(args) {
			calls.push(args);
			const output = outputs.shift();
			if (!output) throw new Error("Unexpected Lavish command");
			return { stdout: output.stdout, stderr: output.stderr ?? "", code: output.code ?? 0 };
		},
		commandForDisplay(args) {
			return `lavish-axi ${args.join(" ")}`;
		},
	};
	return { pi, runner, calls, entries, getTool: () => tool };
}
