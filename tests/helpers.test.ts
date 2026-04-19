import { describe, it, expect } from "vitest";
import { inferWasmFileName, renderVirtualModule } from "../src/helpers.js";

const BASE_ARGS = {
	entryPath: "/abs/pkg/foo.js",
	module: "foo",
	wasmFileName: "foo_bg.wasm",
	wasmPath: "/abs/pkg/foo_bg.wasm",
};

describe("inferWasmFileName", () => {
	it("appends _bg.wasm to a plain module name", () => {
		expect(inferWasmFileName("example_pkg")).toBe("example_pkg_bg.wasm");
	});

	it("replaces hyphens with underscores", () => {
		expect(inferWasmFileName("wasm-calculator")).toBe(
			"wasm_calculator_bg.wasm",
		);
	});

	it("strips the scope from a scoped package", () => {
		expect(inferWasmFileName("@acme/wasm-calc")).toBe("wasm_calc_bg.wasm");
	});
});

describe("renderVirtualModule (autoInit: true)", () => {
	const args = { ...BASE_ARGS, autoInit: true as const };

	it("uses the new wasm-bindgen object-argument init API in the browser branch", () => {
		const out = renderVirtualModule(args);
		expect(out).toContain("await init({ module_or_path: url })");
		expect(out).not.toMatch(/await init\(url\)/);
	});

	it("awaits readFile before calling init on the SSR branch", () => {
		const out = renderVirtualModule(args);
		expect(out).toContain('await import("node:fs/promises")');
		expect(out).toContain("const bytes = await readFile(");
		expect(out).toContain("await init({ module_or_path: bytes })");
		expect(out).not.toMatch(/await init\(readFile\(/);
	});

	it("re-exports everything from the entry module via export-*", () => {
		const out = renderVirtualModule(args);
		expect(out).toContain('export * from "/abs/pkg/foo.js"');
	});

	it("exports wasmUrl as a named binding", () => {
		const out = renderVirtualModule(args);
		expect(out).toContain("export const wasmUrl = url");
	});

	it("does not explicitly re-export init or initSync (star re-export handles them)", () => {
		const out = renderVirtualModule(args);
		expect(out).not.toMatch(/export\s*\{\s*init\b/);
		expect(out).not.toMatch(/export\s*\{\s*initSync\b/);
	});

	it("emits a no-op default export", () => {
		const out = renderVirtualModule(args);
		expect(out).toContain("export default () => {};");
	});
});
