import { test as viTest } from 'vitest';

export function test(name, fn) {
  return viTest(name, async (viCtx) => {
    const befores = [];
    const afters = [];
    let beforesExecuted = false;

    const t = {
      ...viCtx,
      before: (callback) => {
        befores.push(callback);
      },
      after: (callback) => {
        afters.push(callback);
      },
      test: async (subName, subFn) => {
        // Execute befores once before the first subtest runs
        if (!beforesExecuted) {
          beforesExecuted = true;
          for (const beforeFn of befores) {
            await beforeFn();
          }
        }
        // Run the subtest
        await subFn();
      }
    };

    try {
      // Execute the main test function body
      await fn(t);
    } finally {
      // Execute afters in reverse order for cleanups
      for (let i = afters.length - 1; i >= 0; i--) {
        try {
          await afters[i]();
        } catch (err) {
          console.error('Error during t.after cleanup:', err);
        }
      }
    }
  });
}

export default test;
