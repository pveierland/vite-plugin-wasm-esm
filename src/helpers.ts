import { basename, dirname, join } from "node:path";

export function inferWasmFileName(moduleName: string): string {
	return basename(moduleName).replace(/-/g, "_") + "_bg.wasm";
}

export interface RenderVirtualModuleArgs {
	entryPath: string;
	module: string;
	wasmFileName: string;
	wasmPath: string;
	autoInit: boolean;
}

function stripQueryAndHash(p: string): string {
	const queryAt = p.indexOf("?");
	const hashAt = p.indexOf("#");
	const end =
		queryAt === -1 && hashAt === -1
			? p.length
			: queryAt === -1
				? hashAt
				: hashAt === -1
					? queryAt
					: Math.min(queryAt, hashAt);
	return p.slice(0, end);
}

export async function findWasmFileName(
	entryPath: string,
	moduleName: string,
	readFile: (path: string) => Promise<string>,
): Promise<string> {
	const cleanEntry = stripQueryAndHash(entryPath);
	const pkgJsonPath = join(dirname(cleanEntry), "package.json");
	try {
		const raw = await readFile(pkgJsonPath);
		const pkg = JSON.parse(raw) as { files?: unknown };
		if (Array.isArray(pkg.files)) {
			const wasm = pkg.files.find(
				(f): f is string => typeof f === "string" && f.endsWith("_bg.wasm"),
			);
			if (wasm) return wasm;
		}
	} catch {
		// fall through to heuristic
	}
	return inferWasmFileName(moduleName);
}

export function renderVirtualModule(args: RenderVirtualModuleArgs): string {
	const { entryPath, module, wasmFileName, wasmPath, autoInit } = args;
	const entry = JSON.stringify(entryPath);
	const urlImport = JSON.stringify(`${module}/${wasmFileName}?url`);
	const wasmPathLit = JSON.stringify(wasmPath);

	if (autoInit) {
		return `
import init from ${entry};
import url from ${urlImport};
if (!import.meta.env.SSR) {
    await init({ module_or_path: url });
} else {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(${wasmPathLit});
    await init({ module_or_path: bytes });
}
export * from ${entry};
export const wasmUrl = url;
export default () => {};
`;
	}

	return `
import url from ${urlImport};
export * from ${entry};
export const wasmUrl = url;
export default () => {};
`;
}
