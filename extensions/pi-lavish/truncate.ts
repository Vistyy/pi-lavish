import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from "@earendil-works/pi-coding-agent";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLavishField } from "./protocol.js";

async function writeFullOutput(output: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "pi-lavish-"));
	const file = join(dir, "output.txt");
	await writeFile(file, output, "utf8");
	return file;
}

export async function truncateOutput(output: string, label: string): Promise<{
	content: string;
	fullOutputPath?: string;
	truncated: boolean;
}> {
	const truncated = truncateHead(output, {
		maxBytes: DEFAULT_MAX_BYTES,
		maxLines: DEFAULT_MAX_LINES,
	});

	if (!truncated.truncated) {
		return { content: truncated.content, truncated: false };
	}

	const fullOutputPath = await writeFullOutput(output);
	const note = [
		"",
		`[${label} truncated: ${truncated.outputLines} of ${truncated.totalLines} lines, ${formatSize(
			truncated.outputBytes,
		)} of ${formatSize(truncated.totalBytes)}.]`,
		`[Full output saved to: ${fullOutputPath}]`,
	].join("\n");

	return {
		content: `${truncated.content}${note}`,
		fullOutputPath,
		truncated: true,
	};
}

export async function truncateFeedback(feedback: string): Promise<{
	content: string;
	fullFeedbackPath?: string;
	truncated: boolean;
}> {
	const output = await truncateOutput(feedback, "Lavish feedback");
	const nextStep = output.truncated ? readLavishField(feedback, "next_step") : undefined;
	const serializedNextStep = nextStep ? `next_step: ${JSON.stringify(nextStep)}` : undefined;
	const content =
		serializedNextStep && !output.content.includes(serializedNextStep)
			? `${output.content}\n\n[Preserved Lavish next step]\n${serializedNextStep}`
			: output.content;
	return {
		content,
		fullFeedbackPath: output.fullOutputPath,
		truncated: output.truncated,
	};
}
