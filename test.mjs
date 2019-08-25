import { compile } from "./compiler.mjs";

let inputBuffer = [];
let outputBuffer = [];
const testTable = [
  {
    name: "Simple increment",
    program: "+++",
    expected: [3]
  },
  {
    name: "Non-BF characters are ignored",
    program: "+++X+++",
    expected: [6]
  },
  {
    name: "Adding respects pointer position",
    program: "+++>++",
    expected: [3, 2]
  },
  {
    name: "Subtractting respects pointer position",
    program: "+++>++<--",
    expected: [1, 2]
  },
  {
    name: "Simple loop",
    program: "+++[>++<-]",
    expected: [0, 6]
  },
  {
    name: "Instructions after loop are executed",
    program: "+++[>]<+++",
    expected: [6]
  },
  {
    name: "Nested loops",
    program: "+++[>++[>++<-]<-]",
    expected: [0, 0, 12]
  },
  {
    name: "Wrap at 256",
    program: "++++++++[>++++++++[>++++<-]<-]",
    expected: [0, 0, 0]
  },
  {
    name: "Can consume input",
    pre() {
      inputBuffer = [123];
    },
    program: ",",
    expected: [123]
  },
  {
    name: "Can produce output",
    program: "+++.",
    expected: [3],
    post() {
      console.assert(
        outputBuffer[0] === 3,
        `Unexpected output buffer: ${outputBuffer}`
      );
    }
  },
  {
    name: "Underflow is limited to cell",
    program: ">-.<.",
    expected: [],
    post() {
      console.assert(
        outputBuffer[0] === 255 && outputBuffer[1] === 0,
        `Unexpected output buffer: ${outputBuffer}`
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
  for (const { name, pre, program, expected, post } of testTable) {
    inputBuffer = [];
    outputBuffer = [];
    if (pre) {
      pre();
    }
    console.log(`Running "${name}"`);
    const wasm = compile(program);
    const { instance } = await WebAssembly.instantiate(wasm, importObj);
    const memory = new Uint8Array(instance.exports.memory.buffer);
    const relevantMemory = [...memory.slice(0, expected.length)];
    console.assert(
      JSON.stringify(relevantMemory) === JSON.stringify(expected),
      `Error running program "${name}": Expected memory to be ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(relevantMemory)}`
    );
    if (post) {
      post();
    }
  }
}
init();
