import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { LavishReviewDetails } from "./schemas.js";
import { UI_KEY } from "./schemas.js";

interface FileToolTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

export function renderFileToolCall(
	theme: FileToolTheme,
	toolName: string,
	file: string | undefined,
	suffix = "",
): Text {
	const label = theme.fg("toolTitle", theme.bold(`${toolName} `));
	const renderedFile = file ? theme.fg("accent", file) : theme.fg("warning", "<missing file>");
	return new Text(`${label}${renderedFile}${suffix}`, 0, 0);
}

export function buildReviewToolText(details: LavishReviewDetails): string {
	const lines = [`Lavish ${details.state}: ${details.file}`];
	if (details.url) lines.push(`URL: ${details.url}`);
	if (details.state === "waiting") lines.push("Waiting for browser feedback...");
	if (details.fullFeedbackPath) lines.push(`Full feedback: ${details.fullFeedbackPath}`);
	return lines.join("\n");
}

export function setLavishUi(ctx: ExtensionContext, details: LavishReviewDetails): void {
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

export function clearLavishUi(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setStatus(UI_KEY, undefined);
	ctx.ui.setWidget(UI_KEY, undefined);
}
