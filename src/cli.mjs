#!/usr/bin/env -S node --experimental-modules

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

import { promises as fsp } from "fs";
import { compile } from "./compiler.mjs";
import commander from "commander";

const program = new commander.Command();
program
  .option("-o, --output <file>", "File to write compiled Wasm to")
  .option("-r, --run", "Run compiled Wasm (implies --asyncify)")
  .option("--mem-dump <N>", "Dump the first N cells of memory after run")
  .option("--hex-output", "Turn std out into hexadecimap")
  .option("--asyncify", "Run Binaryen Asyncify pass")
  .option("--wasi", "Use WASI for I/O")
  .parse(process.argv);

(async function run() {
  if (program.args.length !== 1) {
    program.outputHelp();
    process.exit(1);
  }

  if (program.wasi && program.run) {
    console.error("The CLI can't run WASI modules.");
    process.exit(1);
  }

  const input = await fsp.readFile(program.args[0], "utf8");
  let wasm = compile(input, {
    useWasi: program.wasi
  });

  if (program.asyncify || program.run) {
    const { default: Binaryen } = await import("binaryen");
    const module = Binaryen.readBinary(new Uint8Array(wasm));
    Binaryen.setOptimizeLevel(0);
    Binaryen.setShrinkLevel(0);
    module.runPasses(["asyncify"]);
    wasm = module.emitBinary();
  }

  if (program.output) {
    await fsp.writeFile(program.output, Buffer.from(wasm));
  }

  const asyncifyStart = 60000;
  const bufferedKeys = [];
  if (program.run) {
    const { instance } = await WebAssembly.instantiate(wasm, {
      env: {
        in() {
          if (bufferedKeys.length > 0) {
            instance.exports.asyncify_stop_rewind();
            return bufferedKeys.shift();
          }
          instance.exports.asyncify_start_unwind(asyncifyStart);
          process.stdin.setRawMode(true);
          process.stdin.once("data", ([key]) => {
            if (key === 3) {
              process.exit();
            }
            bufferedKeys.push(key);
            process.stdin.setRawMode(false);
            instance.exports.asyncify_start_rewind(asyncifyStart);
            instance.exports._start();
          });
        },
        out(v) {
          if (program.hexOutput) {
            process.stdout.write(
              Buffer.from(v.toString(16).padStart(2, "0") + " ")
            );
          } else {
            process.stdout.write(Buffer.from([v]));
          }
        }
      }
    });
    const mem32 = new Uint32Array(instance.exports.memory.buffer);
    mem32[asyncifyStart / 4] = asyncifyStart + 8;
    mem32[asyncifyStart / 4 + 1] = asyncifyStart + 8 + 2048;
    instance.exports._start();
    process.stdout.write(Buffer.from("\n"));
    if (program.memDump) {
      console.log("============================");
      console.log("Memory dump:");
      console.log(
        [...new Uint8Array(instance.exports.memory.buffer, 0, program.memDump)]
          .map(v => v.toString(16).padStart(2, "0"))
          .join(" ")
      );
    }
  }
})();
