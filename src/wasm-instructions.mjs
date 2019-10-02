import { instr } from "./wasm-helpers.mjs";

export const globalGet = idx => instr(0x23, [idx], []);
export const globalSet = (idx, value) => instr(0x24, [idx], [value]);

export const i32Add = (a, b) => instr(0x6a, [], [a, b]);
export const i32Sub = (a, b) => instr(0x6b, [], [a, b]);

export const i32Load8U = (alignment, offset, ptr) =>
  instr(0x2d, [alignment, offset], [ptr]);
export const i32Store8 = (alignment, offset, ptr, value) =>
  instr(0x3a, [alignment, offset], [ptr, value]);
export const i32Store = (alignment, offset, ptr, value) =>
  instr(0x36, [alignment, offset], [ptr, value]);

export const i32Const = value => instr(0x41, [value], []);
export const call = (func_idx, args) => instr(0x10, [func_idx], args);
export const drop = arg => instr(0x1a, [], [arg]);

export const END = 0x0b;
