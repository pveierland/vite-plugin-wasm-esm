// src/index.ts
import { basename } from "path";
var IDENTIFIER = "\0__vite-plugin-wasm-esm";
var ENV_STUB_ID = "\0__vite-plugin-wasm-esm-env-stub";
function wasmFileNameFromModule(module) {
  return basename(module).replace(/-/g, "_") + "_bg.wasm";
}
function wasm(modules) {
  const moduleSet = new Set(modules);
  const resolutions = /* @__PURE__ */ new Map();
  return {
    name: "vite-plugin-wasm-esm",
    enforce: "pre",
    config: () => ({ ssr: { noExternal: modules } }),
    async resolveId(source, importer, options) {
      if (source === "env" && importer) {
        for (const resolution of resolutions.values()) {
          if (importer === resolution.entryPath) {
            return ENV_STUB_ID;
          }
        }
      }
      if (!moduleSet.has(source)) return null;
      const id = `${IDENTIFIER}?${source}`;
      if (!resolutions.has(id)) {
        const resolve = (source2) => this.resolve(source2, importer, { skipSelf: true, ...options });
        const entryResolution = await resolve(source);
        if (!entryResolution) return null;
        const wasmFile = wasmFileNameFromModule(source);
        const wasmResolution = await resolve(`${source}/${wasmFile}`);
        if (!wasmResolution) {
          throw new Error(
            `Expected to find wasm file (${wasmFile}) in module: "${source}".`
          );
        }
        resolutions.set(id, {
          module: source,
          entryPath: entryResolution.id,
          wasmFileName: wasmFile,
          wasmPath: wasmResolution.id
        });
      }
      return id;
    },
    async load(id) {
      if (id === ENV_STUB_ID) return "export default {};";
      const resolution = resolutions.get(id);
      if (!resolution) return null;
      return `
				import init from ${JSON.stringify(resolution.entryPath)};
				import url from ${JSON.stringify(
        `${resolution.module}/${resolution.wasmFileName}?url`
      )};
				if (!import.meta.env.SSR) {
					await init(url);
				} else {
					const { readFile } = await import("fs/promises");
					await init(readFile(${JSON.stringify(resolution.wasmPath)}));
				}
				export * from ${JSON.stringify(resolution.entryPath)};
				export default () => {};
			`;
    }
  };
}
export {
  wasm as default
};
