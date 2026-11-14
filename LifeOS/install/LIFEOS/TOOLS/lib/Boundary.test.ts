/**
 * Tests for Boundary primitives: confinedPath and atomicWrite.
 * Validates path boundary containment, traversal rejection, and cross-platform atomic writes.
 *
 * Issue #2774
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { atomicWrite, confinedPath } from "./Boundary.ts";

describe("Boundary primitives", () => {
  describe("confinedPath", () => {
    const root = join(tmpdir(), "lifeos-boundary-test");

    test("accepts valid relative path inside root", () => {
      const res = confinedPath(tmpdir(), "test-file.txt");
      expect(res).not.toBeNull();
      expect(res).toBe(join(tmpdir(), "test-file.txt"));
    });

    test("accepts valid absolute path inside root", () => {
      const target = join(tmpdir(), "nested", "file.txt");
      const res = confinedPath(tmpdir(), target);
      expect(res).not.toBeNull();
      expect(res).toBe(target);
    });

    test("refuses traversal escaping root via parent segments", () => {
      const res = confinedPath(root, "../escaped.txt");
      expect(res).toBeNull();
    });

    test("refuses traversal after missing component", () => {
      const res = confinedPath(root, "missing/../escaped.txt");
      expect(res).toBeNull();
    });

    test("refuses absolute path pointing outside root", () => {
      const res = confinedPath(root, homedir());
      expect(res).toBeNull();
    });
  });

  describe("atomicWrite", () => {
    test("writes data atomically and creates missing parent directories", () => {
      const target = join(tmpdir(), "lifeos-atomic-test", "sub", "test.txt");
      try {
        atomicWrite(target, "hello boundary");
        expect(existsSync(target)).toBe(true);
        expect(readFileSync(target, "utf8")).toBe("hello boundary");
      } finally {
        try { rmSync(join(tmpdir(), "lifeos-atomic-test"), { recursive: true, force: true }); } catch {}
      }
    });
  });
});