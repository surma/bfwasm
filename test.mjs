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
    name: "Loops should be skipped on 0",
    program: "[+>]",
    expected: [0, 0]
  },
  {
    name: "Instructions after loop are executed",
    program: "+++[>]<+++",
    expected: [6]
  },
  {
    name: "Code after skipped loops should be executed",
    program: "[+>]>+",
    expected: [0, 1]
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
    post() {
      console.assert(
        outputBuffer[0] === 255 && outputBuffer[1] === 0,
        `Unexpected output buffer: ${outputBuffer}`
      );
    }
  },
  {
    name: "Respects exportPointer flag",
    program: "+",
    options: {
      exportPointer: false
    },
    post(instance) {
      console.assert(
        typeof instance.exports.pointer === "undefined",
        "Module exposes pointer despite `exportPointer: false`"
      );
    }
  },
  {
    name: "Respects exportMemory flag",
    program: "+",
    options: {
      exportMemory: false
    },
    post(instance) {
      console.assert(
        typeof instance.exports.memory === "undefined",
        "Module exposes memory despite `exportMemory: false`"
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
  for (const {
    name,
    pre = () => {},
    program,
    options = {},
    expected = [],
    post = () => {}
  } of testTable) {
    inputBuffer = [];
    outputBuffer = [];
    pre();
    console.log(`Running "${name}"`);
    const wasm = compile(program, options);
    const { instance } = await WebAssembly.instantiate(wasm, importObj);
    instance.exports.main();
    const memory = new Uint8Array(
      (instance.exports.memory || new Uint8Array([])).buffer
    );
    const relevantMemory = [...memory.slice(0, expected.length)];
    console.assert(
      JSON.stringify(relevantMemory) === JSON.stringify(expected),
      `Error running program "${name}": Expected memory to be ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(relevantMemory)}`
    );
    post(instance);
  }
}
init();
