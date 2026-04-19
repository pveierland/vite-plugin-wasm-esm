import { describe, it, expect } from "vitest";
import { inferWasmFileName } from "../src/helpers.js";

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
