import { writeFileSync } from "fs";
import { compile } from "./compiler.mjs";

async function init() {
  const wasm = compile("++++++[>++++<-]");
  writeFileSync("output.wasm", Buffer.from(wasm));

  const { instance } = await WebAssembly.instantiate(wasm);
  console.log(new Uint32Array(instance.exports.memory.buffer, 0, 10));
}
init();
