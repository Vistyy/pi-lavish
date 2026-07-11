import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { defaultLavishRunner, runCheckedLavishCommand, type LavishRunner } from "../runner.js";
import { LavishReferenceParams, REFERENCE_TOOL_NAME, type LavishReferenceDetails } from "../schemas.js";
import { truncateOutput } from "../truncate.js";

export function registerReferenceTool(pi: ExtensionAPI, runner: LavishRunner = defaultLavishRunner): void {
	pi.registerTool({
		name: REFERENCE_TOOL_NAME,
		label: "Lavish Reference",
		description: "Fetch Lavish design guidance or focused artifact playbooks for creating reviewable HTML artifacts.",
		promptSnippet: "Fetch Lavish design guidance or playbooks before creating Lavish artifacts.",
		promptGuidelines: [
			"Use lavish_reference before writing Lavish HTML when the lavish skill says a design guide or playbook applies.",
		],
		parameters: LavishReferenceParams,

		async execute(_toolCallId, params, signal) {
			const args = params.action === "design" ? ["design"] : ["playbook", params.playbookId ?? ""];
			if (params.action === "playbook" && !params.playbookId) {
				throw new Error("lavish_reference requires playbookId when action is playbook.");
			}

			const result = await runCheckedLavishCommand(runner, args, signal);

			const output = result.stdout.trim();
			const truncated = await truncateOutput(output || "Lavish reference returned no output.", "Lavish reference");
			const details: LavishReferenceDetails = {
				action: params.action,
				playbookId: params.playbookId,
				fullOutputPath: truncated.fullOutputPath,
				truncated: truncated.truncated,
			};

			return {
				content: [{ type: "text", text: truncated.content }],
				details,
			};
		},

		renderCall(args, theme) {
			const label = theme.fg("toolTitle", theme.bold(`${REFERENCE_TOOL_NAME} `));
			const target = args.action === "playbook" ? `playbook ${args.playbookId ?? "<missing>"}` : "design";
			return new Text(`${label}${theme.fg("accent", target)}`, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as LavishReferenceDetails | undefined;
			const first = result.content[0];
			const text = first?.type === "text" ? first.text : "";
			const header = details
				? theme.fg("success", `Lavish ${details.action}${details.playbookId ? `: ${details.playbookId}` : ""}`)
				: theme.fg("success", "Lavish reference");
			const lines = [header];
			if (details?.fullOutputPath) lines.push(theme.fg("dim", `Full output: ${details.fullOutputPath}`));
			if (expanded && text) lines.push("", text);
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
