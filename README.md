# bfwasm

A [Brainf_ck][bf] to WebAssembly compiler. Yes, compiler. Not interpreter.

## Installation

```
npm install -g bfwasm
```

## Usage (CLI)

```
Usage: bfwasm [options]

Options:
  -o, --output <file>  File to write compiled Wasm to
  -r, --run            Run compiled Wasm (implies --asyncify)
  --mem-dump <N>       Dump the first N cells of memory after run
  --hex-output         Turn std out into hexadecimap
  --asyncify           Run Binaryen Asyncify pass
  -h, --help           output usage information
```

## Usage (API)

```js
import { compile } from "bfwasm";

const wasmBuffer = compile(`
  ++++++++++[>++++++++++++++++++++++
  >+++++++++++++++>++++++++++++++++>+
  <<<<-]>++++++.>+++++++.>++++.
`);

const decoder = new TextDecoder();
const importsObj = {
  env: {
    in() {
      /* Called when bf programm needs input */
      return 0;
    }
    out(v) {
      /* Called when bf programm has output */
      console.log(
        decoder.decode(new Uint8Array([v]), {stream: true})
      );
    }
  }
};
const {instance} = await WebAssembly.instantiate(wasmBuffer, importsObj);
instance.exports.main();
```

**compile(program, options)** compiles `program` to a WebAssembly module exporting a `"main"` function.

Options:

- `exportMemory` (default: `true`) will export the memory as `"memory"`.
- `autoRun` (default: `false`) will declare `"main"` as the module’s start function.

---

License Apache-2.0

[bf]: http://www.muppetlabs.com/~breadbox/bf/
