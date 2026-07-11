import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const LAVISH_SESSION_ENTRY_TYPE = "pi-lavish-session";

export interface LavishSessionRecord {
	absoluteFile: string;
	file: string;
	url?: string;
	state: "waiting" | "feedback" | "ended";
}

const reviewUrls = new Map<string, string>();

export function getReviewUrl(file: string): string | undefined {
	return reviewUrls.get(file);
}

export function rememberReviewUrl(file: string, url: string): void {
	reviewUrls.set(file, url);
}

export function forgetReviewUrl(file: string): void {
	reviewUrls.delete(file);
}

export function clearReviewUrls(): void {
	reviewUrls.clear();
}

export function persistReviewSession(
	pi: ExtensionAPI,
	target: Pick<LavishSessionRecord, "absoluteFile" | "file">,
	state: LavishSessionRecord["state"],
	url?: string,
): void {
	pi.appendEntry(LAVISH_SESSION_ENTRY_TYPE, { version: 1, ...target, ...(url ? { url } : {}), state });
}

function isLavishSessionRecord(value: unknown): value is LavishSessionRecord {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.absoluteFile === "string" &&
		typeof candidate.file === "string" &&
		(candidate.url === undefined || typeof candidate.url === "string") &&
		(candidate.state === "waiting" || candidate.state === "feedback" || candidate.state === "ended")
	);
}

function recordFromEntry(entry: unknown): LavishSessionRecord | undefined {
	if (!entry || typeof entry !== "object") return undefined;
	const candidate = entry as Record<string, any>;
	if (
		candidate.type === "custom" &&
		candidate.customType === LAVISH_SESSION_ENTRY_TYPE &&
		isLavishSessionRecord(candidate.data)
	) {
		const { absoluteFile, file, url, state } = candidate.data;
		return { absoluteFile, file, ...(url ? { url } : {}), state };
	}
	return undefined;
}

export function restoreReviewSessions(entries: readonly unknown[]): LavishSessionRecord | undefined {
	clearReviewUrls();
	const active = new Map<string, LavishSessionRecord>();
	for (const entry of entries) {
		const record = recordFromEntry(entry);
		if (!record) continue;
		active.delete(record.absoluteFile);
		if (record.state === "ended") {
			forgetReviewUrl(record.absoluteFile);
			continue;
		}
		active.set(record.absoluteFile, record);
		if (record.url) rememberReviewUrl(record.absoluteFile, record.url);
	}
	return Array.from(active.values()).at(-1);
}
