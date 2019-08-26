/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function* leb128(v) {
  while (v > 127) {
    yield (1 << 7) | (v & 0xff);
    v = Math.floor(v >> 7);
  }
  yield v;
}

const encoder = new TextEncoder();
function toUTF8(s) {
  return encoder.encode(s);
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
      // i32.load8_u
      0x2d,
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
      // i32.store8
      0x3a,
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
      // i32.load8_u
      0x2d,
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
      // i32.store8
      0x3a,
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
      // i32.const 1
      0x41,
      ...leb128(1)
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
      // i32.const 1
      0x41,
      ...leb128(1)
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
      // i32.load8_u
      0x2d,
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
      // i32.store8
      0x3a,
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
    // Loop with no return value
    0x03,
    0x40
  ],
  "]": [
    ...[
      // global.get 0
      0x23,
      ...leb128(0)
    ],
    ...[
      // i32.load8_u
      0x2d,
      ...leb128(0), // alignment
      ...leb128(0) // offset
    ],
    ...[
      // i32.const 0
      0x41,
      ...leb128(0)
    ],
    ...[
      // i32.ne
      0x47
    ],
    ...[
      // br_if 0
      0x0d,
      ...leb128(0)
    ],
    0x0b // End
  ]
};

function section(idx, data) {
  return [...leb128(idx), ...leb128(data.length), ...data];
}

function createFuncNameSection(funcs) {
  const numFuncs = Object.keys(funcs).length;
  return [
    // Vector of name associations
    ...leb128(numFuncs + 3), // Length
    ...[
      ...leb128(0), // Index
      ...[
        // Name
        ...leb128(2), // Length
        ...toUTF8("in")
      ]
    ],
    ...[
      ...leb128(1), // Index
      ...[
        // Name
        ...leb128(3), // Length
        ...toUTF8("out")
      ]
    ],
    ...Object.keys(funcs).flatMap((name, idx) => [
      ...leb128(idx + 2), // Index
      ...[
        // Name
        ...leb128(name.length + 3), // Length
        ...toUTF8(`op ${name}`)
      ]
    ]),
    ...[
      ...leb128(numFuncs + 2),
      ...[
        // Name
        ...leb128(4), // Length
        ...toUTF8("main")
      ]
    ]
  ];
}

export function compile(bf) {
  const numFuncs = Object.keys(funcs).length;

  const code = [...bf].flatMap(c => codeGenTable[c] || []);
  const funcNameSection = createFuncNameSection(funcs);

  return new Uint8Array([
    ...toUTF8("\0asm"), // Magic
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
            ...toUTF8("env")
          ],
          ...[
            // Import name
            ...leb128(2), // Length
            ...toUTF8("in")
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
            ...toUTF8("env")
          ],
          ...[
            // Import name
            ...leb128(3), // Length
            ...toUTF8("out")
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
            ...toUTF8("memory")
          ],
          0x02, // Memory
          ...leb128(0) // Index 0
        ],
        ...[
          // Export of memory pointer
          ...[
            // Vector of bytes
            ...leb128(7),
            ...toUTF8("pointer")
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
    ),
    ...section(
      0, // Custom section
      [
        // Section name
        ...leb128(4),
        ...toUTF8("name"),
        // Subsection
        1, // Function names
        ...leb128(funcNameSection.length), // Length
        ...funcNameSection
      ]
    )
  ]).buffer;
}
