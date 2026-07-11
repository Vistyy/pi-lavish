import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { cleanToolPath, resolveToolPath } from "../paths.js";
import { readLavishField, translateLavishProtocolForPi } from "../protocol.js";
import { defaultLavishRunner, runCheckedLavishCommand, type LavishRunner } from "../runner.js";
import { EXPORT_TOOL_NAME, LavishExportParams, type LavishExportDetails } from "../schemas.js";
import { truncateOutput } from "../truncate.js";
import { renderFileToolCall } from "../ui.js";

export function registerExportTool(pi: ExtensionAPI, runner: LavishRunner = defaultLavishRunner): void {
	pi.registerTool({
		name: EXPORT_TOOL_NAME,
		label: "Lavish Export",
		description: "Export a Lavish artifact as portable HTML while preserving unresolved-asset warnings.",
		promptSnippet: "Export a Lavish HTML artifact as a portable local file.",
		promptGuidelines: [
			"Use lavish_export when the user asks for a portable or standalone copy of a Lavish artifact.",
			"Review unresolved_local_assets and notices before presenting the export as complete.",
		],
		parameters: LavishExportParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const cleanedFile = cleanToolPath(params.file);
			if (!cleanedFile) throw new Error("lavish_export requires a file path.");
			const { absolutePath: absoluteFile, displayPath: file } = resolveToolPath(ctx.cwd, cleanedFile);
			const cleanedOut = params.out ? cleanToolPath(params.out) : undefined;
			if (params.out !== undefined && !cleanedOut) throw new Error("lavish_export out must be a file path when provided.");
			const absoluteOut = cleanedOut ? resolveToolPath(ctx.cwd, cleanedOut).absolutePath : undefined;
			const args = ["export", absoluteFile];
			if (absoluteOut) args.push("--out", absoluteOut);

			const result = await runCheckedLavishCommand(runner, args, signal);

			const translated = translateLavishProtocolForPi(result.stdout.trim(), { file: absoluteFile });
			const truncated = await truncateOutput(translated || "Lavish export completed without textual output.", "Lavish export");
			const outputFile = absoluteOut ?? readLavishField(result.stdout, "output");
			const details: LavishExportDetails = {
				file,
				outputFile,
				output: truncated.content,
				fullOutputPath: truncated.fullOutputPath,
				truncated: truncated.truncated,
			};
			return { content: [{ type: "text", text: truncated.content }], details };
		},

		renderCall(args, theme) {
			const suffix = args.out ? theme.fg("dim", ` to ${args.out}`) : "";
			return renderFileToolCall(theme, EXPORT_TOOL_NAME, args.file, suffix);
		},

		renderResult(result, _options, theme) {
			const details = result.details as LavishExportDetails | undefined;
			const destination = details?.outputFile ? `: ${details.outputFile}` : "";
			return new Text(theme.fg("success", `Lavish artifact exported${destination}`), 0, 0);
		},
	});
}
