export type LavishSessionStatus = "opened" | "ready" | "feedback" | "ended" | "user-ended" | "waiting";

export interface LavishLayoutWarning {
	selector?: string;
	kind?: string;
	overflowPx?: number;
	viewportWidth?: number;
	severity?: string;
	persistent?: boolean;
}

export interface LavishWhiteboardFeedback {
	scenePath?: string;
	previewPath?: string;
}

export interface LavishProtocolSummary {
	status?: LavishSessionStatus;
	url?: string;
	endedBy?: "user" | "agent";
	sessionEnded: boolean;
	layoutWarnings?: LavishLayoutWarning[];
	whiteboards?: LavishWhiteboardFeedback[];
}

const KNOWN_STATUSES = new Set<LavishSessionStatus>(["opened", "ready", "feedback", "ended", "user-ended", "waiting"]);

function decodeLavishScalar(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
	try {
		return JSON.parse(trimmed) as string;
	} catch {
		return trimmed.slice(1, -1);
	}
}

export function readLavishField(output: string, name: string): string | undefined {
	const match = output.match(new RegExp(`^\\s*${name}:\\s*(.+?)\\s*$`, "m"));
	return decodeLavishScalar(match?.[1]);
}

function parseToonRow(row: string): string[] {
	const cells: string[] = [];
	let cell = "";
	let quoted = false;
	let escaped = false;
	for (const character of row) {
		if (escaped) {
			cell += character;
			escaped = false;
			continue;
		}
		if (character === "\\" && quoted) {
			cell += character;
			escaped = true;
			continue;
		}
		if (character === '"') quoted = !quoted;
		if (character === "," && !quoted) {
			cells.push(cell.trim());
			cell = "";
			continue;
		}
		cell += character;
	}
	cells.push(cell.trim());
	return cells.map((value) => decodeLavishScalar(value) ?? "");
}

function parseLayoutWarnings(output: string): LavishLayoutWarning[] {
	const lines = output.split(/\r?\n/);
	const headerIndex = lines.findIndex((line) => /^layout_warnings\[\d+\]\{[^}]+\}:\s*$/.test(line));
	if (headerIndex < 0) return [];
	const header = lines[headerIndex]?.match(/^layout_warnings\[\d+\]\{([^}]+)\}:/)?.[1];
	if (!header) return [];
	const fields = header.split(",").map((name) => name.trim());
	const warnings: LavishLayoutWarning[] = [];
	for (let index = headerIndex + 1; index < lines.length; index++) {
		const line = lines[index] ?? "";
		if (!/^\s+\S/.test(line)) break;
		const values = parseToonRow(line.trim());
		const record = Object.fromEntries(fields.map((name, fieldIndex) => [name, values[fieldIndex]]));
		warnings.push({
			...(record.selector ? { selector: record.selector } : {}),
			...(record.kind ? { kind: record.kind } : {}),
			...(record.overflowPx && Number.isFinite(Number(record.overflowPx)) ? { overflowPx: Number(record.overflowPx) } : {}),
			...(record.viewportWidth && Number.isFinite(Number(record.viewportWidth))
				? { viewportWidth: Number(record.viewportWidth) }
				: {}),
			...(record.severity ? { severity: record.severity } : {}),
			...(record.persistent === "true" || record.persistent === "false"
				? { persistent: record.persistent === "true" }
				: {}),
		});
	}
	return warnings;
}

function readAllFields(output: string, name: string): string[] {
	const values: string[] = [];
	const pattern = new RegExp(`^\\s*${name}:\\s*(.+?)\\s*$`, "gm");
	for (const match of output.matchAll(pattern)) {
		const value = decodeLavishScalar(match[1]);
		if (value !== undefined) values.push(value);
	}
	return values;
}

function parseWhiteboards(output: string): LavishWhiteboardFeedback[] {
	if (!/\bwhiteboard\b/.test(output)) return [];
	const scenePaths = readAllFields(output, "scenePath");
	const previewPaths = readAllFields(output, "previewPath");
	const count = Math.max(scenePaths.length, previewPaths.length);
	return Array.from({ length: count }, (_, index) => ({
		...(scenePaths[index] ? { scenePath: scenePaths[index] } : {}),
		...(previewPaths[index] ? { previewPath: previewPaths[index] } : {}),
	}));
}

export function inspectLavishProtocol(output: string): LavishProtocolSummary {
	const rawStatus = readLavishField(output, "status");
	const status = rawStatus && KNOWN_STATUSES.has(rawStatus as LavishSessionStatus) ? (rawStatus as LavishSessionStatus) : undefined;
	const rawEndedBy = readLavishField(output, "ended_by");
	const endedBy = rawEndedBy === "user" || rawEndedBy === "agent" ? rawEndedBy : status === "user-ended" ? "user" : undefined;
	const url = readLavishField(output, "url");
	const sessionEnded = readLavishField(output, "session_ended") === "true" || status === "ended" || status === "user-ended";
	const layoutWarnings = parseLayoutWarnings(output);
	const whiteboards = parseWhiteboards(output);

	return {
		...(status ? { status } : {}),
		...(url ? { url } : {}),
		...(endedBy ? { endedBy } : {}),
		sessionEnded,
		...(layoutWarnings.length > 0 ? { layoutWarnings } : {}),
		...(whiteboards.length > 0 ? { whiteboards } : {}),
	};
}

function toolCall(name: string, values: Record<string, string | boolean>): string {
	const params = Object.entries(values)
		.map(([key, value]) => `${key}: ${typeof value === "string" ? JSON.stringify(value) : String(value)}`)
		.join(", ");
	return `${name}(${params})`;
}

function translateCommand(command: string, file: string): string | undefined {
	const pollPrefix = `lavish-axi poll ${file}`;
	if (command === pollPrefix) return toolCall("lavish_review", { file });
	if (command.startsWith(`${pollPrefix} --agent-reply `)) {
		const rawReply = command.slice(`${pollPrefix} --agent-reply `.length).trim();
		let reply = rawReply;
		if (rawReply.startsWith('"') && rawReply.endsWith('"')) {
			try {
				reply = JSON.parse(rawReply) as string;
			} catch {
				reply = rawReply.slice(1, -1);
			}
		}
		return toolCall("lavish_review", { file, agentReply: reply });
	}
	if (command === `lavish-axi ${file} --reopen`) return toolCall("lavish_review", { file, reopen: true });
	if (command === `lavish-axi ${file}`) return toolCall("lavish_review", { file });
	if (command === `lavish-axi end ${file}`) return toolCall("lavish_end", { file });
	return undefined;
}

function translateCommands(text: string, file: string): string {
	return text.replace(/`(lavish-axi [^`]+)`/g, (whole, command: string) => {
		const translated = translateCommand(command, file);
		return translated ? `\`${translated}\`` : whole;
	});
}

export function translateLavishProtocolForPi(output: string, options: { file: string }): string {
	return output
		.split(/\r?\n/)
		.map((line) => {
			const nextStep = line.match(/^(\s*next_step:\s*)(.+)$/);
			if (!nextStep) return line;
			const prefix = nextStep[1] ?? "next_step: ";
			const decoded = decodeLavishScalar(nextStep[2]);
			return decoded === undefined ? line : `${prefix}${JSON.stringify(translateCommands(decoded, options.file))}`;
		})
		.join("\n");
}
