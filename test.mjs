import { compile } from "./compiler.mjs";

let inputBuffer = [];
let outputBuffer = [];
const testTable = [
  {
    program: "+++",
    expected: [3]
  },
  {
    program: "+++X+++",
    expected: [6]
  },
  {
    program: "+++>++",
    expected: [3, 2]
  },
  {
    program: "+++>++<--",
    expected: [1, 2]
  },
  {
    program: "+++[>++<-]",
    expected: [0, 6]
  },
  {
    pre() {
      inputBuffer = [123];
    },
    program: ",",
    expected: [123]
  },
  {
    program: "+++.",
    expected: [3],
    post() {
      console.assert(
        outputBuffer[0] === 3,
        "Expected output buffer to contain 3  "
      );
    }
  }
];

const importObj = {
  env: {
    in() {
      return inputBuffer.shift();
    },
    out(v) {
      outputBuffer.push(v);
    }
  }
};

async function init() {
  for (const { pre, program, expected, post } of testTable) {
    if (pre) {
      pre();
    }
    console.log(`Running ${program}`);
    const wasm = compile(program);
    const { instance } = await WebAssembly.instantiate(wasm, importObj);
    const memory = new Uint32Array(instance.exports.memory.buffer);
    const relevantMemory = [...memory.slice(0, expected.length)];
    console.assert(
      JSON.stringify(relevantMemory) === JSON.stringify(expected),
      `Error running program "${program}": Expected memory to be ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(relevantMemory)}`
    );
    if (post) {
      post();
    }
  }
}
init();
