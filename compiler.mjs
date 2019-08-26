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

import { leb128, toUTF8, vector, section } from "./wasm-helpers.mjs";

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

function createCodeGenTable(numImportFuncs) {
  return {
    ...Object.fromEntries(
      Object.keys(funcs).map((fname, idx) => [
        fname,
        [
          // Call idx
          0x10,
          ...leb128(idx + numImportFuncs)
        ]
      ])
    ),
    "[": [
      // Block with no return value
      0x02,
      0x40,
      // Loop with no return value
      0x03,
      0x40,
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
        // i32.eqz
        0x045
      ],
      ...[
        // br_if
        0x0d,
        ...leb128(1)
      ]
    ],
    "]": [
      ...[
        // br_if 0
        0x0c,
        ...leb128(0)
      ],
      0x0b, // End loop
      0x0b // End block
    ]
  };
}

function createFuncNameSection(funcs) {
  const numFuncs = Object.keys(funcs).length;
  return vector([
    [
      ...leb128(0), // Index
      ...vector(toUTF8("in"))
    ],
    [
      ...leb128(1), // Index
      ...vector(toUTF8("out"))
    ],
    ...Object.keys(funcs).map((name, idx) => [
      ...leb128(idx + 2), // Index
      ...vector(toUTF8(`op ${name}`))
    ]),
    [
      ...leb128(numFuncs + 2), // Index
      ...vector(toUTF8("main"))
    ]
  ]);
}

const defaultOpts = {
  exportPointer: true,
  exportMemory: true,
  autoRun: false
};

export function compile(bf, userOpts = {}) {
  const opts = { ...defaultOpts, ...userOpts };
  const numFuncs = Object.keys(funcs).length;
  const numImportFuncs = 2;

  const exports = [];
  if (opts.exportMemory) {
    exports.push([
      ...vector(toUTF8("memory")),
      0x02, // Memory
      ...leb128(0) // Index 0)
    ]);
  }
  if (opts.exportPointer) {
    exports.push([
      ...vector(toUTF8("pointer")),
      0x03, // Global
      ...leb128(0) // Index 0
    ]);
  }
  exports.push([
    ...vector(toUTF8("main")),
    0x00, // Function,
    ...leb128(numFuncs + numImportFuncs) // Main
  ]);

  const codeGenTable = createCodeGenTable(numImportFuncs);
  const code = [...bf].flatMap(c => codeGenTable[c] || []);
  const funcNameSection = createFuncNameSection(funcs);

  return new Uint8Array([
    ...toUTF8("\0asm"), // Magic
    ...[1, 0, 0, 0], // Version
    ...section(
      1, // Func type section
      vector([
        [
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
        [
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
        [
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
      ])
    ),
    ...section(
      2, // Import section
      vector([
        [
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
        [
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
      ])
    ),
    ...section(
      3, // Function section
      vector([
        ...Object.keys(funcs).flatMap(() => [
          // All functions have type 0
          ...leb128(0)
        ]),
        ...leb128(0) // Main function also has type 0
      ])
    ),
    ...section(
      5, // Memory section
      vector([
        [
          // Memory type
          ...leb128(0), // Minimum only
          ...leb128(1) // Number of pages page
        ]
      ])
    ),
    ...section(
      6, // Global section
      vector([
        [
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
      ])
    ),
    ...section(
      7, // Export section
      vector(exports)
    ),
    ...(opts.autoRun
      ? section(
          8, // Start section
          [
            ...leb128(numFuncs + 2) // Last function
          ]
        )
      : []),
    ...section(
      10, // Code section
      vector([
        ...Object.values(funcs).map(body => [
          ...leb128(body.length + 2),
          ...[
            // Vector of locals
            0 // Length
          ],
          ...body,
          0x0b // End
        ]),
        [
          // Main function
          ...leb128(code.length + 2),
          ...[
            // Vector of locals
            0 // Length
          ],
          ...code,
          0x0b // End
        ]
      ])
    ),
    ...section(
      0, // Custom section
      [
        ...vector(toUTF8("name")),
        // Subsection
        1, // Function names
        ...leb128(funcNameSection.length), // Length
        ...funcNameSection
      ]
    )
  ]).buffer;
}
