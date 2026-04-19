import { describe, it, expect } from "vitest";
import {
	inferWasmFileName,
	renderVirtualModule,
	findWasmFileName,
} from "../src/helpers.js";

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

describe("findWasmFileName", () => {
	it("returns the *_bg.wasm entry from package.json files[]", async () => {
		const readFile = async () =>
			JSON.stringify({
				name: "example_pkg",
				files: ["example_pkg_bg.wasm", "example_pkg.js", "example_pkg.d.ts"],
			});
		const result = await findWasmFileName(
			"/pkg/example_pkg/example_pkg.js",
			"example_pkg",
			readFile,
		);
		expect(result).toBe("example_pkg_bg.wasm");
	});

	it("works for scoped packages (reads package.json from the same directory as the entry)", async () => {
		const seen: string[] = [];
		const readFile = async (path: string) => {
			seen.push(path);
			return JSON.stringify({
				name: "@acme/wasm-calc",
				files: ["wasm_calc_bg.wasm", "wasm_calc.js"],
			});
		};
		const result = await findWasmFileName(
			"/pkg/@acme/wasm-calc/wasm_calc.js",
			"@acme/wasm-calc",
			readFile,
		);
		expect(result).toBe("wasm_calc_bg.wasm");
		expect(seen).toEqual(["/pkg/@acme/wasm-calc/package.json"]);
	});

	it("strips a query string from the entry path before resolving package.json", async () => {
		const seen: string[] = [];
		const readFile = async (path: string) => {
			seen.push(path);
			return JSON.stringify({ name: "x", files: ["x_bg.wasm"] });
		};
		const result = await findWasmFileName(
			"/pkg/x/x.js?v=abc123",
			"x",
			readFile,
		);
		expect(result).toBe("x_bg.wasm");
		expect(seen).toEqual(["/pkg/x/package.json"]);
	});

	it("strips a hash fragment from the entry path before resolving package.json", async () => {
		const seen: string[] = [];
		const readFile = async (path: string) => {
			seen.push(path);
			return JSON.stringify({ name: "x", files: ["x_bg.wasm"] });
		};
		const result = await findWasmFileName(
			"/pkg/x/x.js#section",
			"x",
			readFile,
		);
		expect(result).toBe("x_bg.wasm");
		expect(seen).toEqual(["/pkg/x/package.json"]);
	});

	it("falls back to the heuristic when files[] is absent", async () => {
		const readFile = async () => JSON.stringify({ name: "wasm-calc" });
		const result = await findWasmFileName(
			"/pkg/wasm-calc/wasm_calc.js",
			"wasm-calc",
			readFile,
		);
		expect(result).toBe("wasm_calc_bg.wasm");
	});

	it("falls back to the heuristic when files[] has no wasm entry", async () => {
		const readFile = async () =>
			JSON.stringify({ name: "x", files: ["x.js", "x.d.ts"] });
		const result = await findWasmFileName("/pkg/x/x.js", "x", readFile);
		expect(result).toBe("x_bg.wasm");
	});

	it("falls back to the heuristic when package.json is unreadable", async () => {
		const readFile = async () => {
			throw new Error("ENOENT");
		};
		const result = await findWasmFileName("/pkg/x/x.js", "x", readFile);
		expect(result).toBe("x_bg.wasm");
	});

	it("falls back to the heuristic when package.json is malformed", async () => {
		const readFile = async () => "{ not json";
		const result = await findWasmFileName("/pkg/x/x.js", "x", readFile);
		expect(result).toBe("x_bg.wasm");
	});
});
