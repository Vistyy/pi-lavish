import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { LavishLayoutWarning, LavishSessionStatus, LavishWhiteboardFeedback } from "./protocol.js";

export const REVIEW_TOOL_NAME = "lavish_review";
export const REFERENCE_TOOL_NAME = "lavish_reference";
export const END_TOOL_NAME = "lavish_end";
export const EXPORT_TOOL_NAME = "lavish_export";
export const UI_KEY = "pi-lavish";

export const PLAYBOOK_IDS = ["diagram", "table", "comparison", "plan", "code", "input", "slides"] as const;

export interface LavishReviewDetails {
	state: "opening" | "waiting" | "feedback" | "ended" | "error";
	file: string;
	absoluteFile?: string;
	url?: string;
	status?: LavishSessionStatus;
	sessionEnded?: boolean;
	endedBy?: "user" | "agent";
	layoutWarnings?: LavishLayoutWarning[];
	whiteboards?: LavishWhiteboardFeedback[];
	initialReplySent?: boolean;
	agentReplySent?: boolean;
	feedback?: string;
	fullFeedbackPath?: string;
	truncated?: boolean;
}

export interface LavishReferenceDetails {
	action: "design" | "playbook";
	playbookId?: string;
	fullOutputPath?: string;
	truncated: boolean;
}

export interface LavishEndDetails {
	file: string;
	output: string;
}

export interface LavishExportDetails {
	file: string;
	outputFile?: string;
	output: string;
	fullOutputPath?: string;
	truncated: boolean;
}

export const LavishReviewParams = Type.Object({
	file: Type.String({
		description: "Project-relative or absolute HTML file path to review with Lavish. Strip a leading @ before use.",
	}),
	initialReply: Type.Optional(
		Type.String({
			description: "One-line introduction sent before the first poll describing what to review first.",
		}),
	),
	agentReply: Type.Optional(
		Type.String({
			description: "Reply sent to an active Lavish browser session before waiting for the next feedback.",
		}),
	),
	reopen: Type.Optional(
		Type.Boolean({
			description: "Explicitly reopen a user-ended session. Use only when the user requests further visual review.",
		}),
	),
});

export const LavishReferenceParams = Type.Object({
	action: StringEnum(["design", "playbook"] as const),
	playbookId: Type.Optional(
		StringEnum(PLAYBOOK_IDS, {
			description: "Required when action is playbook.",
		}),
	),
});

export const LavishEndParams = Type.Object({
	file: Type.String({
		description: "Project-relative or absolute HTML file path for the Lavish session to end.",
	}),
});

export const LavishExportParams = Type.Object({
	file: Type.String({
		description: "Project-relative or absolute HTML file path to export as a portable artifact.",
	}),
	out: Type.Optional(
		Type.String({
			description: "Optional project-relative or absolute output HTML path.",
		}),
	),
});
