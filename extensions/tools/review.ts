import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { relative, resolve } from "node:path";
import { commandForDisplay, combinedOutput, runLavishAxi } from "../runner.js";
import { LavishReviewParams, REVIEW_TOOL_NAME, type LavishReviewDetails } from "../schemas.js";
import { truncateFeedback } from "../truncate.js";
import { buildReviewToolText, setLavishUi } from "../ui.js";

const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/g;

function cleanPath(input: string): string {
	return input.trim().replace(/^@+/, "");
}

function displayPath(cwd: string, absolutePath: string): string {
	const rel = relative(cwd, absolutePath);
	if (!rel || rel.startsWith("..")) return absolutePath;
	return rel;
}

function extractUrl(output: string): string | undefined {
	const matches = output.match(URL_PATTERN);
	const url = matches?.at(-1);
	return url?.replace(/[.,;:]+$/, "");
}

export function registerReviewTool(pi: ExtensionAPI): void {
	pi.registerTool({
		name: REVIEW_TOOL_NAME,
		label: "Lavish Review",
		description:
			"Open a file in Lavish for browser review, show the review URL in Pi, wait for browser feedback, and optionally send an agent reply before polling again.",
		promptSnippet: "Open a Lavish browser review session for a file and wait for human feedback.",
		promptGuidelines: [
			"Use lavish_review when the user asks for Lavish, browser review, visual review, or feedback through a browser session.",
			"After receiving Lavish feedback, call lavish_review again with agentReply when you need to reply to the browser reviewer and wait for the next response.",
			"Use lavish_end when the Lavish review is finished.",
		],
		parameters: LavishReviewParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const cleanedPath = cleanPath(params.file);
			if (!cleanedPath) throw new Error("lavish_review requires a file path.");

			const absoluteFile = resolve(ctx.cwd, cleanedPath);
			const file = displayPath(ctx.cwd, absoluteFile);
			const agentReply = params.agentReply?.trim();
			let url: string | undefined;

			if (!agentReply) {
				const opening: LavishReviewDetails = { state: "opening", file };
				setLavishUi(ctx, opening);
				onUpdate?.({ content: [{ type: "text", text: buildReviewToolText(opening) }], details: opening });

				const openResult = await runLavishAxi([absoluteFile], signal);
				const openOutput = combinedOutput(openResult);
				if (openResult.code !== 0) {
					throw new Error(`${commandForDisplay([absoluteFile])} failed with code ${openResult.code}.\n${openOutput}`);
				}
				url = extractUrl(openOutput);
			}

			const waiting: LavishReviewDetails = {
				state: "waiting",
				file,
				url,
				agentReplySent: Boolean(agentReply),
			};
			setLavishUi(ctx, waiting);
			onUpdate?.({ content: [{ type: "text", text: buildReviewToolText(waiting) }], details: waiting });

			const pollArgs = ["poll", absoluteFile];
			if (agentReply) pollArgs.push("--agent-reply", agentReply);

			const pollResult = await runLavishAxi(pollArgs, signal);
			const pollOutput = combinedOutput(pollResult);
			if (pollResult.code !== 0) {
				throw new Error(`${commandForDisplay(pollArgs)} failed with code ${pollResult.code}.\n${pollOutput}`);
			}

			const rawFeedback = pollOutput || "Lavish poll completed without textual feedback.";
			const feedback = await truncateFeedback(rawFeedback);
			const finalDetails: LavishReviewDetails = {
				state: "feedback",
				file,
				url,
				agentReplySent: Boolean(agentReply),
				feedback: feedback.content,
				fullFeedbackPath: feedback.fullFeedbackPath,
				truncated: feedback.truncated,
			};

			setLavishUi(ctx, finalDetails);

			return {
				content: [{ type: "text", text: feedback.content }],
				details: finalDetails,
			};
		},

		renderCall(args, theme) {
			const label = theme.fg("toolTitle", theme.bold(`${REVIEW_TOOL_NAME} `));
			const file = args.file ? theme.fg("accent", args.file) : theme.fg("warning", "<missing file>");
			const reply = args.agentReply ? theme.fg("dim", " with agent reply") : "";
			return new Text(`${label}${file}${reply}`, 0, 0);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as LavishReviewDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}

			if (isPartial) {
				const lines = [
					theme.fg("warning", `Lavish ${details.state}`),
					theme.fg("muted", details.file),
					details.url ? theme.fg("accent", details.url) : undefined,
					details.state === "waiting" ? theme.fg("dim", "Waiting for browser feedback...") : undefined,
				].filter((line): line is string => Boolean(line));
				return new Text(lines.join("\n"), 0, 0);
			}

			const lines = [theme.fg("success", "Lavish feedback received"), theme.fg("muted", details.file)];
			if (details.url) lines.push(theme.fg("accent", details.url));
			if (details.fullFeedbackPath) lines.push(theme.fg("dim", `Full feedback: ${details.fullFeedbackPath}`));
			if (expanded && details.feedback) lines.push("", details.feedback);

			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
