# vite-plugin-wasm-esm (internal fork)

Internal fork of [`vite-plugin-wasm-esm`](https://github.com/omnysecurity/vite-plugin-wasm-esm). Lives in `git@github.com:pveierland/vite-plugin-wasm-esm.git` and is typically consumed as a git submodule at `packages/vite-plugin-wasm-esm`.

Exists to:

1. Use the current wasm-bindgen `init({ module_or_path })` API, silencing the deprecation warning wasm-bindgen emits when `init()` is called with a positional URL argument.
2. Track Vite 7 in `peerDependencies`.
3. Resolve the `_bg.wasm` filename from the target package's `package.json` `files[]` with a heuristic fallback.
4. Expose an `autoInit: false` option for advanced consumers that want to drive init themselves.

Assumes wasm-pack `--target web` output. Other targets are not supported.

## Consumption

When mounted as a submodule at `packages/vite-plugin-wasm-esm`, a consuming app can depend on it via bun's link protocol:

```json
"vite-plugin-wasm-esm": "link:vite-plugin-wasm-esm"
```

`bun install` then creates a symlink `node_modules/vite-plugin-wasm-esm -> ../../packages/vite-plugin-wasm-esm`.

## Local development workflow

```bash
cd packages/vite-plugin-wasm-esm
pnpm install    # once
pnpm build      # rebuild dist/ after editing src/
pnpm test       # run the helper unit tests
```

After rebuilding, no `bun install` is needed in the consuming app — the symlink points at the same filesystem, so consumers pick up the new `dist/` automatically on next build.

## Options

```ts
import wasm from "vite-plugin-wasm-esm";

wasm(["my-wasm-pkg"]); // default: autoInit = true
wasm(["my-wasm-pkg"], { autoInit: false }); // opt out; drive init yourself
```

When `autoInit: false`, the emitted virtual module does not call `init()` and does not import the default export. Consumers import whatever they need from the target package's named exports (`init`, `initSync`, plus all wasm-bindgen-generated functions), along with a re-exported `wasmUrl` — the bundler-resolved URL of the `_bg.wasm` file:

```ts
import { init, initSync, wasmUrl, some_exported_fn } from "my-wasm-pkg";

// Example: share a compiled module across workers (initSync path).
const mod = await WebAssembly.compileStreaming(fetch(wasmUrl));
initSync({ module: mod });
```

## License

MIT (inherited from upstream).
