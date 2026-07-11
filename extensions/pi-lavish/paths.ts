import { relative, resolve } from "node:path";

export function cleanToolPath(input: string): string {
	return input.trim().replace(/^@+/, "");
}

export function resolveToolPath(cwd: string, input: string): { absolutePath: string; displayPath: string } {
	const absolutePath = resolve(cwd, input);
	const rel = relative(cwd, absolutePath);
	const displayPath = !rel || rel === ".." || rel.startsWith("../") ? absolutePath : rel;
	return { absolutePath, displayPath };
}
