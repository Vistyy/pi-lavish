import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

export const REVIEW_TOOL_NAME = "lavish_review";
export const REFERENCE_TOOL_NAME = "lavish_reference";
export const END_TOOL_NAME = "lavish_end";
export const UI_KEY = "pi-lavish";

export const PLAYBOOK_IDS = ["diagram", "table", "comparison", "plan", "code", "input", "slides"] as const;

export interface LavishReviewDetails {
	state: "opening" | "waiting" | "feedback" | "error";
	file: string;
	url?: string;
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

export const LavishReviewParams = Type.Object({
	file: Type.String({
		description: "Project-relative or absolute HTML file path to review with Lavish. Strip a leading @ before use.",
	}),
	agentReply: Type.Optional(
		Type.String({
			description:
				"Reply to send back to the active Lavish browser session before waiting for the next feedback. Omit on the first call.",
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
