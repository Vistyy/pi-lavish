import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { relative, resolve } from "node:path";
import { commandForDisplay, combinedOutput, runLavishAxi } from "../runner.js";
import { END_TOOL_NAME, LavishEndParams, type LavishEndDetails } from "../schemas.js";
import { forgetReviewUrl } from "../sessions.js";
import { clearLavishUi, setLavishUi } from "../ui.js";

function cleanPath(input: string): string {
	return input.trim().replace(/^@+/, "");
}

function displayPath(cwd: string, absolutePath: string): string {
	const rel = relative(cwd, absolutePath);
	if (!rel || rel === ".." || rel.startsWith("../")) return absolutePath;
	return rel;
}

export function registerEndTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: END_TOOL_NAME,
		label: "Lavish End",
		description: "End a Lavish browser review session for an HTML artifact.",
		promptSnippet: "End a Lavish browser review session after feedback is complete.",
		promptGuidelines: ["Use lavish_end when the browser reviewer is satisfied or asks to finish the Lavish session."],
		parameters: LavishEndParams,

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const cleanedPath = cleanPath(params.file);
			if (!cleanedPath) throw new Error("lavish_end requires a file path.");

			const absoluteFile = resolve(ctx.cwd, cleanedPath);
			const file = displayPath(ctx.cwd, absoluteFile);

			try {
				const result = await runLavishAxi(["end", absoluteFile], signal);
				const output = combinedOutput(result);
				if (result.code !== 0) {
					throw new Error(`${commandForDisplay(["end", absoluteFile])} failed with code ${result.code}.\n${output}`);
				}

				forgetReviewUrl(absoluteFile);
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
			const label = theme.fg("toolTitle", theme.bold(`${END_TOOL_NAME} `));
			const file = args.file ? theme.fg("accent", args.file) : theme.fg("warning", "<missing file>");
			return new Text(`${label}${file}`, 0, 0);
		},

		renderResult(result, _options, theme) {
			const details = result.details as LavishEndDetails | undefined;
			return new Text(theme.fg("success", `Lavish session ended${details ? `: ${details.file}` : ""}`), 0, 0);
		},
	});
}
