import type { Plugin } from "vite";
import { readFile } from "node:fs/promises";
import { findWasmFileName, renderVirtualModule } from "./helpers.js";

const IDENTIFIER = "\0__vite-plugin-wasm-esm";

export interface WasmEsmOptions {
	autoInit?: boolean;
}

interface Resolution {
	module: string;
	entryPath: string;
	wasmFileName: string;
	wasmPath: string;
}

export default function wasm(
	modules: string[],
	options: WasmEsmOptions = {},
): Plugin {
	const autoInit = options.autoInit !== false;
	const moduleSet = new Set(modules);
	const resolutions = new Map<string, Resolution>();

	return {
		name: "vite-plugin-wasm-esm",
		enforce: "pre",
		config: () => ({ ssr: { noExternal: modules } }),

		async resolveId(source, importer, opts) {
			if (!moduleSet.has(source)) return null;
			const id = `${IDENTIFIER}?${source}`;
			if (!resolutions.has(id)) {
				const resolve = (s: string) =>
					this.resolve(s, importer, { skipSelf: true, ...opts });
				const entryResolution = await resolve(source);
				if (!entryResolution) return null;

				const wasmFileName = await findWasmFileName(
					entryResolution.id,
					source,
					(p) => readFile(p, "utf8"),
				);
				const wasmResolution = await resolve(`${source}/${wasmFileName}`);
				if (!wasmResolution) {
					throw new Error(
						`Expected to find wasm file (${wasmFileName}) in module: "${source}".`,
					);
				}

				resolutions.set(id, {
					module: source,
					entryPath: entryResolution.id,
					wasmFileName,
					wasmPath: wasmResolution.id,
				});
			}
			return id;
		},

		async load(id) {
			const resolution = resolutions.get(id);
			if (!resolution) return null;
			return renderVirtualModule({ ...resolution, autoInit });
		},
	};
}
