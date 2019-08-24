function* leb128(v) {
  while (v > 127) {
    yield (1 << 7) | (v & 0xff);
    v = Math.floor(v >> 7);
  }
  yield v;
}

const funcs = {
  "+": [
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // i32.load
      ...leb128(0x28),
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.const 1
      ...leb128(0x41),
      ...leb128(1)
    ],
    ...[
      // i32.add
      ...leb128(0x6a)
    ],
    ...[
      // i32.store
      ...leb128(0x36),
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ]
  ],
  "-": [
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // i32.load
      ...leb128(0x28),
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.const 1
      ...leb128(0x41),
      ...leb128(1)
    ],
    ...[
      // i32.sub
      ...leb128(0x6b)
    ],
    ...[
      // i32.store
      ...leb128(0x36),
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ]
  ],
  ">": [
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // i32.const 4
      ...leb128(0x41),
      ...leb128(4)
    ],
    ...[
      // i32.add
      ...leb128(0x6a)
    ],
    ...[
      // global.set 0
      ...leb128(0x24),
      ...leb128(0)
    ]
  ],
  "<": [
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // i32.const 4
      ...leb128(0x41),
      ...leb128(4)
    ],
    ...[
      // i32.sub
      ...leb128(0x6b)
    ],
    ...[
      // global.set 0
      ...leb128(0x24),
      ...leb128(0)
    ]
  ]
};

const opLookup = {
  ...Object.fromEntries(
    Object.keys(funcs).map((fname, idx) => [
      fname,
      [...leb128(0x10), ...leb128(idx)]
    ])
  ),
  "[": [
    0x03, // Loop
    0x40, // No return value
    ...[
      // global.get 0
      ...leb128(0x23),
      ...leb128(0)
    ],
    ...[
      // i32.load
      ...leb128(0x28),
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.eqz
      0x45
    ],
    ...[
      // br_if 1
      0x0d,
      ...leb128(1)
    ]
  ],
  "]": [
    0x0c, // Br 0
    ...leb128(0),
    0x0b // End
  ]
};

function section(idx, data) {
  return [...leb128(idx), ...leb128(data.length), ...data];
}

function compileBrainfuck(bf) {
  const numFuncs = Object.keys(funcs).length;

  const code = [...bf].flatMap(c => opLookup[c]);

  return new Uint8Array([
    ...Buffer.from("\0asm"), // Magic
    ...[1, 0, 0, 0], // Version
    ...section(
      1, // Func type section
      [
        // Vector of func types
        ...leb128(1), // Length
        ...[
          ...leb128(0x60), // Func type
          ...[
            // Vector of paramters
            ...leb128(0) // Length
          ],
          ...[
            // Vector of return types
            ...leb128(0) // Length
          ]
        ]
      ]
    ),
    ...section(
      3, // Function section
      [
        // Vector of function types
        ...leb128(numFuncs + 1), // Length
        ...Object.keys(funcs).flatMap(() => [
          // All functions have type 0
          ...leb128(0)
        ]),
        ...leb128(0) // Main function also has type 0
      ]
    ),
    ...section(
      5, // Memory section
      [
        // Vector of memories
        ...leb128(1), // Length
        ...[
          // Memory type
          ...leb128(0), // Minimum only
          ...leb128(1) // Number of pages page
        ]
      ]
    ),
    ...section(
      6, // Global section
      [
        // Vector of globals
        ...leb128(1), // Length
        ...[
          // Global for memory pointer
          ...leb128(0x7f), // i32
          ...leb128(0x01), // Mutable
          ...[
            // Expr
            ...leb128(0x41), // i32.const
            ...leb128(0), // Value
            ...leb128(0x0b) // End
          ]
        ]
      ]
    ),
    ...section(
      7, // Export section
      [
        // Vector of exports
        ...leb128(2), // Length
        ...[
          // Export of memory
          ...[
            // Vector of bytes
            ...leb128(6),
            ...Buffer.from("memory")
          ],
          ...leb128(0x02), // Memory
          ...leb128(0) // Index 0
        ],
        ...[
          // Export of memory pointer
          ...[
            // Vector of bytes
            ...leb128(7),
            ...Buffer.from("pointer")
          ],
          ...leb128(0x03), // Global
          ...leb128(0) // Index 0
        ]
      ]
    ),
    ...section(
      8, // Start section
      [
        ...leb128(numFuncs) // Last function
      ]
    ),
    ...section(
      10, // Code section
      [
        // Vector of function bodies
        ...leb128(numFuncs + 1), // Length
        ...[
          ...Object.values(funcs).flatMap(body => [
            ...leb128(body.length + 2),
            ...[
              // Vector of locals
              0 // Length
            ],
            ...body,
            0x0b // End
          ]),
          ...[
            ...leb128(code.length + 2),
            ...[
              // Vector of locals
              0 // Length
            ],
            ...code,
            0x0b // End
          ]
        ]
      ]
    )
  ]).buffer;
}

async function init() {
  const wasm = compileBrainfuck("++++++[>++++<-]");
  require("fs").writeFileSync("output.wasm", Buffer.from(wasm));

  const { instance } = await WebAssembly.instantiate(wasm);
  console.log(new Uint32Array(instance.exports.memory.buffer, 0, 10));
}
init();
