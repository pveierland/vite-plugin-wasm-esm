import { basename } from "node:path";

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
