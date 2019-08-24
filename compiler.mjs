export function* leb128(v) {
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
      0x23,
      ...leb128(0)
    ],
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.load
      0x28,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.const 1
      0x41,
      ...leb128(1)
    ],
    ...[
      // i32.add
      0x6a
    ],
    ...[
      // i32.store
      0x36,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ]
  ],
  "-": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.load
      0x28,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.const 1
      0x41,
      ...leb128(1)
    ],
    ...[
      // i32.sub
      0x6b
    ],
    ...[
      // i32.store
      0x36,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ]
  ],
  ">": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.const 4
      0x41,
      ...leb128(4)
    ],
    ...[
      // i32.add
      0x6a
    ],
    ...[
      // global.set 0
      0x24,
      ...leb128(0)
    ]
  ],
  "<": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.const 4
      0x41,
      ...leb128(4)
    ],
    ...[
      // i32.sub
      0x6b
    ],
    ...[
      // global.set 0
      0x24,
      ...leb128(0)
    ]
  ],
  ".": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.load
      0x28,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // Call out()
      0x10,
      ...leb128(1)
    ]
  ],
  ",": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // Call in()
      0x10,
      ...leb128(0)
    ],
    ...[
      // i32.store
      0x36,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ]
  ]
};

const codeGenTable = {
  ...Object.fromEntries(
    Object.keys(funcs).map((fname, idx) => [
      fname,
      [
        // Call idx
        0x10,
        ...leb128(idx + 2) // +2 for in() and out() imports
      ]
    ])
  ),
  "[": [
    0x03, // Loop
    0x40, // No return value
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.load
      0x28,
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

export function compile(bf) {
  const numFuncs = Object.keys(funcs).length;

  const code = [...bf].flatMap(c => codeGenTable[c] || []);

  return new Uint8Array([
    ...Buffer.from("\0asm"), // Magic
    ...[1, 0, 0, 0], // Version
    ...section(
      1, // Func type section
      [
        // Vector of func types
        ...leb128(3), // Length
        ...[
          // Op func type
          0x60, // Func type
          ...[
            // Vector of paramters
            ...leb128(0) // Length
          ],
          ...[
            // Vector of return types
            ...leb128(0) // Length
          ]
        ],
        ...[
          // Stdin func type
          0x60, // Func type
          ...[
            // Vector of paramters
            ...leb128(0) // Length
          ],
          ...[
            // Vector of return types
            ...leb128(1), // Length
            0x7f // i32
          ]
        ],
        ...[
          // Stdout func type
          0x60, // Func type
          ...[
            // Vector of paramters
            ...leb128(1), // Length
            0x7f // i32
          ],
          ...[
            // Vector of return types
            ...leb128(0) // Length
          ]
        ]
      ]
    ),
    ...section(
      2, // Import section
      [
        // Vector of imports
        ...leb128(2), // Length
        ...[
          // Stdin func import
          ...[
            // Module name
            ...leb128(3), // Length
            ...Buffer.from("env")
          ],
          ...[
            // Import name
            ...leb128(2), // Length
            ...Buffer.from("in")
          ],
          ...[
            // Import type
            0, // Func
            1 // Stdin func type
          ]
        ],
        ...[
          // Stdout func import
          ...[
            // Module name
            ...leb128(3), // Length
            ...Buffer.from("env")
          ],
          ...[
            // Import name
            ...leb128(3), // Length
            ...Buffer.from("out")
          ],
          ...[
            // Import type
            0, // Func
            2 // Stdin func type
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
          0x7f, // i32
          0x01, // Mutable
          ...[
            // Expr
            0x41, // i32.const 0
            ...leb128(0),
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
          0x02, // Memory
          ...leb128(0) // Index 0
        ],
        ...[
          // Export of memory pointer
          ...[
            // Vector of bytes
            ...leb128(7),
            ...Buffer.from("pointer")
          ],
          0x03, // Global
          ...leb128(0) // Index 0
        ]
      ]
    ),
    ...section(
      8, // Start section
      [
        ...leb128(numFuncs + 2) // Last function
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
            // Main function
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
