import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectLavishProtocol, translateLavishProtocolForPi } from "../extensions/pi-lavish/protocol.js";

const artifact = "/tmp/review artifact.html";

test("final user feedback remains visible and ends the session", () => {
	const output = `session:
  file: "${artifact}"
  status: feedback
  session_ended: true
  ended_by: user
prompts[1]{prompt,tag}:
  "Move the title",message
next_step: "The user ended this Lavish session after sending final feedback. Stop polling and do not reopen it unless the user explicitly asks."`;

	assert.deepEqual(inspectLavishProtocol(output), {
		status: "feedback",
		endedBy: "user",
		sessionEnded: true,
	});
	assert.match(translateLavishProtocolForPi(output, { file: artifact }), /Move the title/);
	assert.match(translateLavishProtocolForPi(output, { file: artifact }), /Stop polling and do not reopen/);
});

test("user-ended status identifies the browser user without an explicit ended_by field", () => {
	const output = `session:\n  file: "${artifact}"\n  status: user-ended\nnext_step: "Do not reopen uninvited."`;
	assert.deepEqual(inspectLavishProtocol(output), {
		status: "user-ended",
		endedBy: "user",
		sessionEnded: true,
	});
});

test("user-ended open guidance keeps explicit reopen semantics", () => {
	const output = `session:
  file: "${artifact}"
  status: user-ended
  ended_by: user
next_step: "The user ended this session. Do not reopen it uninvited. When reopening is warranted, run \`lavish-axi ${artifact} --reopen\`."`;

	assert.deepEqual(inspectLavishProtocol(output), {
		status: "user-ended",
		endedBy: "user",
		sessionEnded: true,
	});
	const translated = translateLavishProtocolForPi(output, { file: artifact });
	assert.match(translated, /Do not reopen it uninvited/);
	const serializedNextStep = translated.match(/^next_step:\s*(.+)$/m)?.[1];
	assert.ok(serializedNextStep);
	const nextStep = JSON.parse(serializedNextStep) as string;
	assert.match(nextStep, /lavish_review\(file: "\/tmp\/review artifact\.html", reopen: true\)/);
	assert.doesNotMatch(nextStep, /lavish-axi \/tmp\/review artifact\.html --reopen/);
});

test("layout and whiteboard instructions survive command translation", () => {
	const output = `session:
  file: "${artifact}"
  status: feedback
layout_warnings[1]{severity,persistent}:
  error,false
prompts[1]{prompt,tag}:
  "Updated flow",whiteboard
next_step: "Fix fresh error-severity warnings. Read the whiteboard summary first and update Mermaid source, never the .excalidraw scene. Then run \`lavish-axi poll ${artifact} --agent-reply \\\"<message for the user>\\\"\`."`;

	const translated = translateLavishProtocolForPi(output, { file: artifact });
	assert.match(translated, /Fix fresh error-severity warnings/);
	assert.match(translated, /update Mermaid source, never the \.excalidraw scene/);
	const serializedNextStep = translated.match(/^next_step:\s*(.+)$/m)?.[1];
	assert.ok(serializedNextStep);
	const nextStep = JSON.parse(serializedNextStep) as string;
	assert.match(nextStep, /lavish_review\(file: "\/tmp\/review artifact\.html", agentReply: "<message for the user>"\)/);
});

test("user feedback text is never rewritten as agent guidance", () => {
	const output = `session:\n  status: feedback\nprompts[1]{prompt,tag}:\n  "Please document \`lavish-axi poll ${artifact}\`",message\nnext_step: "Run \`lavish-axi poll ${artifact}\`."`;
	const translated = translateLavishProtocolForPi(output, { file: artifact });
	assert.match(translated, /Please document `lavish-axi poll \/tmp\/review artifact\.html`/);
	assert.match(translated, /lavish_review/);
});

test("layout warnings and whiteboard feedback are exposed structurally", () => {
	const output = `session:\n  status: feedback\nlayout_warnings[1]{selector,kind,overflowPx,viewportWidth,severity,persistent}:\n  "main > h1",clipped-text,8,1341,error,false\nprompts[1]:\n  - tag: whiteboard\n    prompt: "Move the decision node"\n    target:\n      scenePath: "/tmp/scene.excalidraw"\n      previewPath: "/tmp/scene.png"\nnext_step: "Update Mermaid source."`;

	assert.deepEqual(inspectLavishProtocol(output), {
		status: "feedback",
		sessionEnded: false,
		layoutWarnings: [
			{
				selector: "main > h1",
				kind: "clipped-text",
				overflowPx: 8,
				viewportWidth: 1341,
				severity: "error",
				persistent: false,
			},
		],
		whiteboards: [
			{
				scenePath: "/tmp/scene.excalidraw",
				previewPath: "/tmp/scene.png",
			},
		],
	});
});

test("session URL comes from the protocol field instead of unrelated guidance", () => {
	const output = `session:
  file: "${artifact}"
  url: "http://workstation.example:4387/session/abc"
  status: opened
next_step: "See https://example.com/docs then run \`lavish-axi poll ${artifact}\`."`;

	assert.deepEqual(inspectLavishProtocol(output), {
		status: "opened",
		url: "http://workstation.example:4387/session/abc",
		sessionEnded: false,
	});
});
