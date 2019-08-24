import { promises as fsp } from "fs";
import { compile } from "./compiler.mjs";
import commander from "commander";

const program = new commander.Command();
program
  .option("--output <file>", "File to write compiled Wasm to")
  .option("--no-run", "Don’t run compiled Wasm")
  .option("--mem-dump <N>", "Dump the first N cells of memory after run")
  .option("--hex-output", "Turn std out into hexadecimap")
  .parse(process.argv);

const importObj = {
  env: {
    in() {
      return 0;
    },
    out(v) {
      if (program.hexOutput) {
        process.stdout.write(Buffer.from(v.toString(16).padStart(8, "0")));
        process.stdout.write(Buffer.from(" "));
      } else {
        process.stdout.write(Buffer.from([v]));
      }
    }
  }
};

(async function run() {
  if (program.args.length !== 1) {
    program.outputHelp();
    process.exit(1);
  }
  const input = await fsp.readFile(program.args[0], "utf8");
  const wasm = compile(input);
  if (program.outfile) {
    await fsp.writeFile(program.outfile, Buffer.from(wasm));
  }
  if (program.run) {
    const { instance } = await WebAssembly.instantiate(wasm, importObj);
    if (program.memDump) {
      console.log("============================");
      console.log("Memory dump:");
      console.log(
        [...new Uint32Array(instance.exports.memory.buffer, 0, program.memDump)]
          .map(v => v.toString(16).padStart(8, "0"))
          .join(" ")
      );
    }
  }
})();
