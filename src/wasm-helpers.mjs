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
  fromIterable,
  streamAsyncIterator,
  reduceCopy
} from "./stream-helpers.mjs";

export function* leb128(v) {
  while (v > 127) {
    yield (1 << 7) | (v & 0xff);
    v = Math.floor(v >> 7);
  }
  yield v;
}

const encoder = new TextEncoder();
export function toUTF8(s) {
  return [...encoder.encode(s)];
}

export function section(idx, data) {
  return [...leb128(idx), ...leb128(data.length), ...data];
}

// Creates a vector with the given items
export function vector(items) {
  return [...leb128(items.length), ...items.flat()];
}

// Creates a section with id `idx` and the contents of the stream from `rs`
export async function lazySection(idx, rs) {
  const { accumulator: size, stream } = await reduceCopy(
    rs,
    (sum, c) => sum + c.length,
    0
  );
  return concat(fromIterable([...leb128(idx), ...leb128(size)]), stream);
}

// Creates a vector from the stream `rs`. Each item on the stream has to be a
// stream, yielding the contents of that item.
export async function lazyVector(rs) {
  const { size: length, stream } = await reduceCopy(rs, (sum, c) => sum++, 0);
  return new ReadableStream({
    async start(controller) {
      for (const chunk of [...leb128(length)]) {
        controller.enqueue(chunk);
      }
      for await (const s of streamAsyncIterator(stream)) {
        for await (const chunk of streamAsyncIterator(s)) {
          controller.enqueue(chunk);
        }
      }
      controller.close();
    }
  });
}
