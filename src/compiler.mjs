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

import { leb128, toUTF8, vector, section, instr } from "./wasm-helpers.mjs";
import * as i from "./wasm-instructions.mjs";

const defaultOpts = {
  exportMemory: true,
  autoRun: false,
  useWasi: false
};

function generateFunctions(opts) {
  return {
    "+": [
      ...i.i32Store8(
        0,
        0,
        i.globalGet(0),
        i.i32Add(i.i32Load8U(0, 0, i.globalGet(0)), i.i32Const(1))
      )
    ],
    "-": [
      ...i.i32Store8(
        0,
        0,
        i.globalGet(0),
        i.i32Sub(i.i32Load8U(0, 0, i.globalGet(0)), i.i32Const(1))
      )
    ],
    ">": [...i.globalSet(0, i.i32Add(i.globalGet(0), i.i32Const(1)))],
    "<": [...i.globalSet(0, i.i32Sub(i.globalGet(0), i.i32Const(1)))],
    ".": opts.useWasi
      ? [
          ...i.i32Store(0, 0, i.i32Const(60000), i.globalGet(0)),
          ...i.i32Store(0, 0, i.i32Const(60004), i.i32Const(1)),
          ...i.drop(
            i.call(1, [
              i.i32Const(1),
              i.i32Const(60000),
              i.i32Const(1),
              i.i32Const(60008)
            ])
          )
        ]
      : [...i.call(1, [i.i32Load8U(0, 0, i.globalGet(0))])],
    ",": opts.useWasi
      ? [
          ...i.i32Store(0, 0, i.i32Const(60000), i.globalGet(0)),
          ...i.i32Store(0, 0, i.i32Const(60004), i.i32Const(1)),
          ...i.drop(
            i.call(0, [
              i.i32Const(1),
              i.i32Const(60000),
              i.i32Const(1),
              i.i32Const(60008)
            ])
          )
        ]
      : [...i.i32Store8(0, 0, i.globalGet(0), i.call(0, []))]
  };
}

function createCodeGenTable(funcs, numImportFuncs) {
  return {
    ...Object.fromEntries(
      Object.keys(funcs).map((fname, idx) => [
        fname,
        [...i.call(numImportFuncs + idx, [])]
      ])
    ),
    "[": [
      // Block with no return value
      0x02,
      0x40,
      // Loop with no return value
      0x03,
      0x40,
      // br_if
      ...instr(
        0x0d,
        [1],
        [
          // i32.eqz
          instr(0x045, [], [i.i32Load8U(0, 0, i.globalGet(0))])
        ]
      )
    ],
    "]": [
      // br 0
      ...instr(0x0c, [0], []),
      i.END, // End loop
      i.END // End block
    ]
  };
}

function createFuncNameSection(funcs) {
  return vector(
    [
      "in",
      "out",
      ...Object.keys(funcs).map(name => `op ${name}`),
      "_start"
    ].map((name, idx) => [...leb128(idx), ...vector(toUTF8(name))])
  );
}

export function compile(bf, userOpts = {}) {
  const opts = { ...defaultOpts, ...userOpts };
  const funcs = generateFunctions(opts);
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
  exports.push([
    ...vector(toUTF8("_start")),
    0x00, // Function,
    ...leb128(numFuncs + numImportFuncs) // Main
  ]);

  const codeGenTable = createCodeGenTable(funcs, numImportFuncs);
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
          // Vector of parameters
          ...vector([]),
          // Vector of return types
          ...vector([])
        ],
        ...(opts.useWasi
          ? [
              [
                // Wasi FD type
                0x60, // Func type
                // Vector of parameters
                ...vector([
                  0x7f, // i32
                  0x7f, // i32
                  0x7f, // i32
                  0x7f // i32
                ]),
                // Vector of return types
                ...vector([
                  0x7f // i32
                ])
              ]
            ]
          : [
              [
                // Stdin func type
                0x60, // Func type
                // Vector of parameters
                ...vector([]),
                // Vector of return types
                ...vector([
                  0x7f // i32
                ])
              ],
              [
                // Stdout func type
                0x60, // Func type
                // Vector of parameters
                ...vector([
                  0x7f // i32
                ]),
                // Vector of return types
                ...vector([])
              ]
            ])
      ])
    ),
    ...section(
      2, // Import section
      opts.useWasi
        ? vector([
            [
              // Stdin func import
              // Module name
              ...vector(toUTF8("wasi_unstable")),
              // Import name
              ...vector(toUTF8("fd_read")),
              ...[
                // Import type
                0, // Func
                1 // Wasi FD type
              ]
            ],
            [
              // Stdout func import
              // Module name
              ...vector(toUTF8("wasi_unstable")),
              // Import name
              ...vector(toUTF8("fd_write")),
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
              // Module name
              ...vector(toUTF8("env")),
              // Import name
              ...vector(toUTF8("in")),
              ...[
                // Import type
                0, // Func
                1 // Stdin func type
              ]
            ],
            [
              // Stdout func import
              // Module name
              ...vector(toUTF8("env")),
              // Import name
              ...vector(toUTF8("out")),
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
            ...i.i32Const(0),
            i.END // End
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
          // Vector of locals
          ...vector([]),
          ...body,
          i.END // End
        ]),
        [
          // Main function
          ...leb128(code.length + 2),
          // Vector of locals
          ...vector([]),
          ...code,
          i.END // End
        ]
      ])
    ),
    ...section(
      0, // Custom section
      [
        ...vector(toUTF8("name")),
        // Subsection
        ...section(
          1, // Function names
          funcNameSection
        )
      ]
    )
  ]).buffer;
}
