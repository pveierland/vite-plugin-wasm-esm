import { basename } from "node:path";

export function inferWasmFileName(moduleName: string): string {
	return basename(moduleName).replace(/-/g, "_") + "_bg.wasm";
}
