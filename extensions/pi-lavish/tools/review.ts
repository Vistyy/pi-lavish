import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { cleanToolPath, resolveToolPath } from "../paths.js";
import { inspectLavishProtocol, translateLavishProtocolForPi } from "../protocol.js";
import { defaultLavishRunner, runCheckedLavishCommand, type LavishRunner } from "../runner.js";
import { LavishReviewParams, REVIEW_TOOL_NAME, type LavishReviewDetails } from "../schemas.js";
import {
	forgetReviewUrl,
	getReviewUrl,
	persistReviewSession,
	rememberReviewUrl,
	type LavishSessionRecord,
} from "../sessions.js";
import { truncateFeedback } from "../truncate.js";
import { buildReviewToolText, clearLavishUi, renderFileToolCall, setLavishUi } from "../ui.js";

type ReviewTarget = Pick<LavishSessionRecord, "absoluteFile" | "file">;

async function buildFeedbackResult(
	stdout: string,
	absoluteFile: string,
	details: Omit<LavishReviewDetails, "feedback" | "fullFeedbackPath" | "truncated">,
) {
	const translated = translateLavishProtocolForPi(stdout, { file: absoluteFile });
	const feedback = await truncateFeedback(translated || "Lavish returned no textual feedback.");
	return {
		content: [{ type: "text" as const, text: feedback.content }],
		details: {
			...details,
			feedback: feedback.content,
			fullFeedbackPath: feedback.fullFeedbackPath,
			truncated: feedback.truncated,
		},
	};
}

export function registerReviewTool(pi: ExtensionAPI, runner: LavishRunner = defaultLavishRunner): void {
	pi.registerTool({
		name: REVIEW_TOOL_NAME,
		label: "Lavish Review",
		description:
			"Open or resume a file in Lavish for browser review, wait for browser feedback, and preserve user-ended session intent.",
		promptSnippet: "Open or resume a Lavish browser review session and wait for human feedback.",
		promptGuidelines: [
			"Use lavish_review when the user asks for Lavish, browser review, visual review, or feedback through a browser session.",
			"On the first call, use initialReply for a one-line summary of what to review first.",
			"After feedback, use agentReply to respond in the browser and wait again.",
			"Use reopen only when the user explicitly asks for more visual review or important new content warrants it.",
			"Use lavish_end when the Lavish review is finished.",
		],
		parameters: LavishReviewParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const cleanedPath = cleanToolPath(params.file);
			if (!cleanedPath) throw new Error("lavish_review requires a file path.");
			if (params.initialReply?.trim() && params.agentReply?.trim()) {
				throw new Error("lavish_review accepts initialReply or agentReply, not both.");
			}

			const resolved = resolveToolPath(ctx.cwd, cleanedPath);
			const target: ReviewTarget = { absoluteFile: resolved.absolutePath, file: resolved.displayPath };
			const { absoluteFile } = target;
			const initialReply = params.initialReply?.trim();
			if (initialReply && /[\r\n]/.test(initialReply)) throw new Error("lavish_review initialReply must be one line.");
			const agentReply = params.agentReply?.trim();
			const reply = initialReply || agentReply;
			let url = getReviewUrl(absoluteFile);
			const shouldOpen = Boolean(initialReply || params.reopen || !agentReply || !url);

			try {
				if (shouldOpen) {
					const opening: LavishReviewDetails = { state: "opening", ...target, url };
					setLavishUi(ctx, opening);
					onUpdate?.({ content: [{ type: "text", text: buildReviewToolText(opening) }], details: opening });

					const openArgs = [absoluteFile];
					if (params.reopen) openArgs.push("--reopen");
					const openResult = await runCheckedLavishCommand(runner, openArgs, signal);

					const openOutput = openResult.stdout.trim();
					const openSummary = inspectLavishProtocol(openOutput);
					url = openSummary.url ?? url;
					if (url) rememberReviewUrl(absoluteFile, url);

					if (openSummary.sessionEnded) {
						forgetReviewUrl(absoluteFile);
						clearLavishUi(ctx);
						persistReviewSession(pi, target, "ended", url);
						return buildFeedbackResult(openOutput, absoluteFile, {
							state: "ended",
							...target,
							url,
							status: openSummary.status,
							sessionEnded: true,
							endedBy: openSummary.endedBy,
						});
					}
				}

				const waiting: LavishReviewDetails = {
					state: "waiting",
					...target,
					url,
					initialReplySent: Boolean(initialReply),
					agentReplySent: Boolean(agentReply),
				};
				setLavishUi(ctx, waiting);
				persistReviewSession(pi, target, "waiting", url);
				onUpdate?.({ content: [{ type: "text", text: buildReviewToolText(waiting) }], details: waiting });

				const pollArgs = ["poll", absoluteFile];
				if (reply) pollArgs.push("--agent-reply", reply);
				const pollResult = await runCheckedLavishCommand(runner, pollArgs, signal);

				const pollOutput = pollResult.stdout.trim();
				const summary = inspectLavishProtocol(pollOutput);
				const result = await buildFeedbackResult(pollOutput, absoluteFile, {
					state: summary.sessionEnded ? "ended" : "feedback",
					...target,
					url,
					status: summary.status,
					sessionEnded: summary.sessionEnded,
					endedBy: summary.endedBy,
					layoutWarnings: summary.layoutWarnings,
					whiteboards: summary.whiteboards,
					initialReplySent: Boolean(initialReply),
					agentReplySent: Boolean(agentReply),
				});
				const finalDetails = result.details;

				if (summary.sessionEnded) {
					forgetReviewUrl(absoluteFile);
					persistReviewSession(pi, target, "ended", url);
					clearLavishUi(ctx);
				} else {
					persistReviewSession(pi, target, "feedback", url);
					setLavishUi(ctx, finalDetails);
				}

				return result;
			} catch (error) {
				if (signal?.aborted) clearLavishUi(ctx);
				else setLavishUi(ctx, { state: "error", ...target, url });
				throw error;
			}
		},

		renderCall(args, theme) {
			const reply = args.initialReply || args.agentReply ? theme.fg("dim", " with agent message") : "";
			const reopen = args.reopen ? theme.fg("warning", " reopening") : "";
			return renderFileToolCall(theme, REVIEW_TOOL_NAME, args.file, `${reply}${reopen}`);
		},

		renderResult(result, { expanded, isPartial }, theme) {
			const details = result.details as LavishReviewDetails | undefined;
			if (!details) {
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "", 0, 0);
			}

			if (isPartial) {
				const lines = [
					theme.fg(details.state === "error" ? "error" : "warning", `Lavish ${details.state}`),
					theme.fg("muted", details.file),
					details.url ? theme.fg("accent", details.url) : undefined,
					details.state === "waiting" ? theme.fg("dim", "Waiting for browser feedback...") : undefined,
				].filter((line): line is string => Boolean(line));
				return new Text(lines.join("\n"), 0, 0);
			}

			const endedBy = details.endedBy ? ` by ${details.endedBy}` : "";
			const title = details.state === "ended" ? `Lavish session ended${endedBy}` : "Lavish feedback received";
			const lines = [theme.fg(details.state === "ended" ? "muted" : "success", title), theme.fg("muted", details.file)];
			if (details.url) lines.push(theme.fg("accent", details.url));
			if (details.fullFeedbackPath) lines.push(theme.fg("dim", `Full feedback: ${details.fullFeedbackPath}`));
			if (expanded && details.feedback) lines.push("", details.feedback);
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
