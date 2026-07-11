import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { cleanToolPath, resolveToolPath } from "../paths.js";
import { defaultLavishRunner, runCheckedLavishCommand, type LavishRunner } from "../runner.js";
import { END_TOOL_NAME, LavishEndParams, type LavishEndDetails } from "../schemas.js";
import { forgetReviewUrl, persistReviewSession } from "../sessions.js";
import { clearLavishUi, renderFileToolCall, setLavishUi } from "../ui.js";

export function registerEndTool(pi: ExtensionAPI, runner: LavishRunner = defaultLavishRunner): void {
	pi.registerTool({
		name: END_TOOL_NAME,
		label: "Lavish End",
		description: "End a Lavish browser review session for an HTML artifact.",
		promptSnippet: "End a Lavish browser review session after feedback is complete.",
		promptGuidelines: ["Use lavish_end when the browser reviewer is satisfied or asks to finish the Lavish session."],
		parameters: LavishEndParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const cleanedPath = cleanToolPath(params.file);
			if (!cleanedPath) throw new Error("lavish_end requires a file path.");

			const { absolutePath: absoluteFile, displayPath: file } = resolveToolPath(ctx.cwd, cleanedPath);

			try {
				const args = ["end", absoluteFile];
				const result = await runCheckedLavishCommand(runner, args, signal);
				const output = result.stdout.trim();

				forgetReviewUrl(absoluteFile);
				persistReviewSession(pi, { absoluteFile, file }, "ended");
				clearLavishUi(ctx);
				const text = output || `Ended Lavish session for ${file}.`;
				const details: LavishEndDetails = { file, output: text };

				return {
					content: [{ type: "text", text }],
					details,
				};
			} catch (error) {
				if (signal?.aborted) {
					clearLavishUi(ctx);
				} else {
					setLavishUi(ctx, { state: "error", file });
				}
				throw error;
			}
		},

		renderCall(args, theme) {
			return renderFileToolCall(theme, END_TOOL_NAME, args.file);
		},

		renderResult(result, _options, theme) {
			const details = result.details as LavishEndDetails | undefined;
			return new Text(theme.fg("success", `Lavish session ended${details ? `: ${details.file}` : ""}`), 0, 0);
		},
	});
}
