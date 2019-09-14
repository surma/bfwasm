export function chainTransforms(rs, ...transforms) {
  for (const {
    start = () => {},
    transform = (chunk, controller) => controller.enqueue(chunk),
    flush = () => {}
  } of transforms) {
    rs = new ReadableStream({
      async start(controller) {
        await start(controller);
        for await (const chunk of rs) {
          await transform(chunk, controller);
        }
        await flush(controller);
        controller.close();
      }
    });
  }
  return rs;
}

export function concat(...rss) {
  return new ReadableStream({
    async start(controller) {
      for (const rs of rss) {
        for await (const chunk of rs) {
          controller.enqueue(chunk);
        }
      }
      controller.close();
    }
  });
}

export function fromIterable(it) {
  return new ReadableStream({
    start(controller) {
      for (const v of it) {
        controller.enqueue(v);
      }
      controller.close();
    }
  });
}

export async function toArray(rs) {
  const array = [];
  for await (const chunk of rs) {
    array.push(chunk);
  }
  return array;
}

export async function reduceCopy(rs, f, v0) {
  const [rs1, stream] = rs.tee();
  for await (const chunk of rs1) {
    v0 = f(v0, chunk);
  }
  return { stream, accumulator: v0 };
}

export function streamAsyncIterator(stream) {
  const reader = stream.getReader();

  return {
    next() {
      return reader.read();
    },
    return() {
      reader.releaseLock();
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
