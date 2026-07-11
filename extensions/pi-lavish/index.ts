import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { restoreReviewSessions } from "./sessions.js";
import { registerEndTool } from "./tools/end.js";
import { registerExportTool } from "./tools/export.js";
import { registerReferenceTool } from "./tools/reference.js";
import { registerReviewTool } from "./tools/review.js";
import { clearLavishUi, setLavishUi } from "./ui.js";

export default function lavishExtension(pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const restored = restoreReviewSessions(ctx.sessionManager.getBranch());
		if (restored) setLavishUi(ctx, restored);
		else clearLavishUi(ctx);
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

	registerReferenceTool(pi);
	registerReviewTool(pi);
	registerEndTool(pi);
	registerExportTool(pi);
}
