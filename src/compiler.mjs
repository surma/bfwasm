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

import {
  leb128,
  toUTF8,
  vector,
  section,
  lazyVector,
  lazySection
} from "./wasm-helpers.mjs";
import {
  concat,
  fromIterable,
  toArray,
  chainTransforms
} from "./stream-helpers.mjs";

const defaultOpts = {
  exportMemory: true,
  autoRun: false,
  useWasi: false
};

function createOpFuncs(opts) {
  return {
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
    ".": opts.useWasi
      ? [
          ...[
            0x41, // i32.const 60000
            ...leb128(60000)
          ],
          ...[
            // global.get 0
            0x23,
            ...leb128(0)
          ],
          ...[
            // i32.store
            0x36,
            ...leb128(0), // alignment
            ...leb128(0) // offset
          ],
          ...[
            0x41, // i32.const 60004
            ...leb128(60004)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(1)
          ],
          ...[
            // i32.store
            0x36,
            ...leb128(0), // alignment
            ...leb128(0) // offset
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(1)
          ],
          ...[
            0x41, // i32.const 60000
            ...leb128(60000)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(1)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(60008)
          ],
          ...[
            // Call out()
            0x10,
            ...leb128(1)
          ],
          0x1a // drop
        ]
      : [
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
    ",": opts.useWasi
      ? [
          ...[
            0x41, // i32.const 60000
            ...leb128(60000)
          ],
          ...[
            // global.get 0
            0x23,
            ...leb128(0)
          ],
          ...[
            // i32.store
            0x36,
            ...leb128(0), // alignment
            ...leb128(0) // offset
          ],
          ...[
            0x41, // i32.const 60004
            ...leb128(60004)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(1)
          ],
          ...[
            // i32.store
            0x36,
            ...leb128(0), // alignment
            ...leb128(0) // offset
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(0)
          ],
          ...[
            0x41, // i32.const 60000
            ...leb128(60000)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(1)
          ],
          ...[
            0x41, // i32.const 1
            ...leb128(60008)
          ],
          ...[
            // Call in()
            0x10,
            ...leb128(0)
          ],
          0x1a // drop
        ]
      : [
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
}

function createCodeGenTable(opFuncs, numImportFuncs) {
  return {
    ...Object.fromEntries(
      Object.keys(opFuncs).map((fname, idx) => [
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

function tokenizer(bf) {
  let char = 0;
  let line = 0;
  return new ReadableStream({
    start(controller) {
      for (const token of bf) {
        controller.enqueue({ token, line, char });
        char++;
        if (token === "\n") {
          char = 0;
          line++;
        }
      }
    }
  });
}

function codeGen(opFuncs, numImportFuncs, opts) {
  const codeGenTable = createCodeGenTable(opFuncs, numImportFuncs);

  return {
    transform(chunk, controller) {
      for (const op of codeGenTable[chunk] || []) {
        controller.enqueue(op);
      }
    },
    flush(controller) {
      controller.enqueue(0x0b);
    }
  };
}

function header() {
  return fromIterable([
    ...toUTF8("\0asm"), // Magic
    ...[1, 0, 0, 0] // Version 1 (MVP)
  ]);
}

function typeSection(opts) {
  return fromIterable(
    section(
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
        ...(opts.useWasi
          ? [
              [
                // Wasi FD type
                0x60, // Func type
                ...[
                  // Vector of paramters
                  ...leb128(4), // Length
                  0x7f, // i32
                  0x7f, // i32
                  0x7f, // i32
                  0x7f // i32
                ],
                ...[
                  // Vector of return types
                  ...leb128(1), // Length
                  0x7f // i32
                ]
              ]
            ]
          : [
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
      ])
    )
  );
}

function importSection(opts) {
  return fromIterable(
    section(
      2, // Import section
      opts.useWasi
        ? vector([
            [
              // Stdin func import
              ...[
                // Module name
                ...leb128(13), // Length
                ...toUTF8("wasi_unstable")
              ],
              ...[
                // Import name
                ...leb128(7), // Length
                ...toUTF8("fd_read")
              ],
              ...[
                // Import type
                0, // Func
                1 // Wasi FD type
              ]
            ],
            [
              // Stdout func import
              ...[
                // Module name
                ...leb128(13), // Length
                ...toUTF8("wasi_unstable")
              ],
              ...[
                // Import name
                ...leb128(8), // Length
                ...toUTF8("fd_write")
              ],
              ...[
                // Import type
                0, // Func
                1 // Wasi FD type
              ]
            ]
          ])
        : vector([
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
    )
  );
}

function functionSection(opFuncs, opts) {
  return fromIterable(
    section(
      3, // Function section
      vector([
        ...Object.keys(opFuncs).flatMap(() => [
          // All functions have type 0
          ...leb128(0)
        ]),
        ...leb128(0) // Main function also has type 0
      ])
    )
  );
}

function memorySection(opts) {
  return fromIterable(
    section(
      5, // Memory section
      vector([
        [
          // Memory type
          ...leb128(0), // Minimum only
          ...leb128(1) // Number of pages page
        ]
      ])
    )
  );
}

function globalSection(opts) {
  return fromIterable(
    section(
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
    )
  );
}

function exportSection(opFuncs, numImportFuncs, opts) {
  const exports = [];
  const numFuncs = Object.keys(opFuncs).length;
  exports.push([
    ...vector(toUTF8("main")),
    0x00, // Function,
    ...leb128(numFuncs + numImportFuncs) // Main
  ]);
  return fromIterable(
    section(
      7, // Export section
      vector([
        [
          ...vector(toUTF8("main")),
          0x00, // Function,
          ...leb128(numFuncs + numImportFuncs) // Main
        ],
        ...(opts.exportMemory
          ? [
              [
                ...vector(toUTF8("memory")),
                0x02, // Memory
                ...leb128(0) // Index 0)
              ]
            ]
          : [])
      ])
    )
  );
}

function startSection(opts) {
  return fromIterable(
    opts.autoRun
      ? section(
          8, // Start section
          [
            ...leb128(numFuncs + 2) // Last function
          ]
        )
      : []
  );
}

async function codeSection(bf, opFuncs, numImportFuncs, opts) {
  return lazySection(
    10,
    await lazyVector(
      fromIterable([
        // All predefined functions
        ...Object.values(opFuncs).map(v =>
          concat(fromIterable(v), fromIterable([0x0b]))
        ),
        // Main function
        concat(
          // Locals
          fromIterable(vector([])),
          // Body
          chainTransforms(tokenizer(bf), codeGen(opFuncs, numImportFuncs, opts))
        )
      ])
    )
  );
}

export async function compile(bf, userOpts = {}) {
  const opts = { ...defaultOpts, ...userOpts };
  const opFuncs = createOpFuncs(opts);
  const numImportFuncs = 2;

  const stream = concat(
    await header(),
    await typeSection(opts),
    await importSection(opts),
    await functionSection(opFuncs, opts),
    await memorySection(opts),
    await globalSection(opts),
    await exportSection(opFuncs, numImportFuncs, opts),
    await startSection(opts),
    await codeSection(bf, opFuncs, numImportFuncs, opts)
  );
  console.log("ay");

  const chunks = [];

  for await (const chunk of streamAsyncIterator(stream)) {
    console.log({ chunk });
    chunks.push(chunk);
  }
  return chunks;
}

// const funcNameSection = createFuncNameSection(funcs);

//   ...section(
//     0, // Custom section
//     [
//       ...vector(toUTF8("name")),
//       // Subsection
//       1, // Function names
//       ...leb128(funcNameSection.length), // Length
//       ...funcNameSection
//     ]
//   )
// ]).buffer;
// }
