import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	truncateHead,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { Type } from "typebox";

const TOOL_NAME = "lavish_review";
const UI_KEY = "pi-lavish";
const URL_PATTERN = /https?:\/\/[^\s)"'<>]+/g;

interface LavishReviewDetails {
	state: "opening" | "waiting" | "feedback" | "error";
	file: string;
	url?: string;
	agentReplySent?: boolean;
	feedback?: string;
	fullFeedbackPath?: string;
	truncated?: boolean;
}

const LavishReviewParams = Type.Object({
	file: Type.String({
		description: "Project-relative or absolute file path to review with Lavish. Strip a leading @ before use.",
	}),
	agentReply: Type.Optional(
		Type.String({
			description:
				"Reply to send back to the active Lavish browser session before waiting for the next feedback. Omit on the first call.",
		}),
	),
});

function cleanPath(input: string): string {
	return input.trim().replace(/^@+/, "");
}

function displayPath(cwd: string, absolutePath: string): string {
	const rel = relative(cwd, absolutePath);
	if (!rel || rel.startsWith("..")) return absolutePath;
	return rel;
}

function combinedOutput(result: { stdout?: string; stderr?: string }): string {
	return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function extractUrl(output: string): string | undefined {
	const matches = output.match(URL_PATTERN);
	const url = matches?.at(-1);
	return url?.replace(/[.,;:]+$/, "");
}

function buildToolText(details: LavishReviewDetails): string {
	const lines = [`Lavish ${details.state}: ${details.file}`];
	if (details.url) lines.push(`URL: ${details.url}`);
	if (details.state === "waiting") lines.push("Waiting for browser feedback...");
	if (details.fullFeedbackPath) lines.push(`Full feedback: ${details.fullFeedbackPath}`);
	return lines.join("\n");
}

function setLavishUi(ctx: ExtensionContext, details: LavishReviewDetails): void {
	if (!ctx.hasUI) return;

	const theme = ctx.ui.theme;
	const stateText = details.state === "feedback" ? "feedback received" : details.state;
	ctx.ui.setStatus(UI_KEY, `${theme.fg("accent", "Lavish")} ${theme.fg("dim", stateText)}`);

	const lines = [
		`Lavish: ${stateText}`,
		`File: ${details.file}`,
		...(details.url ? [`URL: ${details.url}`] : []),
		details.state === "waiting" ? "Waiting for browser feedback in Lavish." : undefined,
		details.fullFeedbackPath ? `Full feedback: ${details.fullFeedbackPath}` : undefined,
	].filter((line): line is string => Boolean(line));

	ctx.ui.setWidget(UI_KEY, lines);
}

function clearLavishUi(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(UI_KEY, undefined);
	ctx.ui.setWidget(UI_KEY, undefined);
}

async function writeFullFeedback(feedback: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-lavish-"));
	const file = join(dir, "feedback.txt");
	await writeFile(file, feedback, "utf8");
	return file;
}

async function truncateFeedback(feedback: string): Promise<{
	content: string;
	fullFeedbackPath?: string;
	truncated: boolean;
}> {
	const truncated = truncateHead(feedback, {
		maxBytes: DEFAULT_MAX_BYTES,
		maxLines: DEFAULT_MAX_LINES,
	});

	if (!truncated.truncated) {
		return { content: truncated.content, truncated: false };
	}

	const fullFeedbackPath = await writeFullFeedback(feedback);
	const note = [
		"",
		`[Lavish feedback truncated: ${truncated.outputLines} of ${truncated.totalLines} lines, ${formatSize(
			truncated.outputBytes,
		)} of ${formatSize(truncated.totalBytes)}.]`,
		`[Full feedback saved to: ${fullFeedbackPath}]`,
	].join("\n");

	return {
		content: `${truncated.content}${note}`,
		fullFeedbackPath,
		truncated: true,
	};
}

function commandForDisplay(args: string[]): string {
	return ["lavish", ...args].map((arg) => (arg.includes(" ") ? JSON.stringify(arg) : arg)).join(" ");
}

export default function lavishExtension(pi: ExtensionAPI) {
	pi.on("session_start", async () => {
		// UI is populated only while a Lavish tool call is active.
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		clearLavishUi(ctx);
	});

	pi.registerCommand("lavish-clear", {
		description: "Clear the Lavish status widget.",
		handler: async (_args, ctx) => {
			clearLavishUi(ctx);
			if (ctx.hasUI) ctx.ui.notify("Cleared Lavish UI state.", "info");
		},
	});

	pi.registerTool({
		name: TOOL_NAME,
		label: "Lavish Review",
		description:
			"Open a file in Lavish for browser review, show the review URL in Pi, wait for browser feedback, and optionally send an agent reply before polling again.",
		promptSnippet: "Open a Lavish browser review session for a file and wait for human feedback.",
		promptGuidelines: [
			"Use lavish_review when the user asks for Lavish, browser review, visual review, or feedback through a browser session.",
			"After receiving Lavish feedback, call lavish_review again with agentReply when you need to reply to the browser reviewer and wait for the next response.",
			"Do not use raw shell lavish commands when lavish_review is available.",
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
				onUpdate?.({ content: [{ type: "text", text: buildToolText(opening) }], details: opening });

				const openResult = await pi.exec("lavish", [absoluteFile], { signal });
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
			onUpdate?.({ content: [{ type: "text", text: buildToolText(waiting) }], details: waiting });

			const pollArgs = ["poll", absoluteFile];
			if (agentReply) pollArgs.push("--agent-reply", agentReply);

			const pollResult = await pi.exec("lavish", pollArgs, { signal });
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
			const label = theme.fg("toolTitle", theme.bold(`${TOOL_NAME} `));
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
