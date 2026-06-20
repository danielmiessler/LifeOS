// Unit test for SatisfactionCapture's rating-validity guard.
//
// The success path must only persist a rating the model actually returned in
// the 1-10 band. Anything else is the absence of a signal and must NOT be
// coerced into a neutral 5 (which pollutes every running average).
//
// Run:  bun test isValidRating.test.ts
import { test, expect } from "bun:test";
import { isValidRating } from "../SatisfactionCapture.hook.ts";

test("accepts valid 1-10 ratings", () => {
  for (const v of [1, 5, 10, 7.5]) {
    expect(isValidRating(v)).toBe(true);
  }
});

test("rejects values that must not become a fabricated 5", () => {
  for (const v of [null, undefined, 0, 0.9, 11, -1, NaN, Infinity, -Infinity, "5", {}, [], true]) {
    expect(isValidRating(v as unknown)).toBe(false);
  }
});
