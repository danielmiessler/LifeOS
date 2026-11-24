import { describe, expect, test } from "bun:test";
import { credentialRefusal, maskContentAddresses } from "./refuse";

const H64 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256 of ""
const H40 = "da39a3ee5e6b4b0d3255bfef95601890afd80709"; // sha1 of ""
const slug = (t: string) => credentialRefusal(t, { slugs: true });

describe("content-addressed filenames in STATVS slug mode", () => {
  test("a commit row naming Calibrate artifacts is recorded", () => {
    expect(slug(`CUSTOMIZATIONS/SKILLS/Calibrate/Targets/demo/artifacts/${H64}.md`)).toBeNull();
    expect(slug(`objects/ab/${H40}.json`)).toBeNull();
    expect(slug(["files", `a/${H64}.md`, `b/${H40}.png`].join("\n"))).toBeNull();
  });

  test("everything else that looks like a hex token is still refused", () => {
    for (const t of [
      H64, // bare
      `token=${H64}`, // no slash
      `a/${H64}`, // no extension
      `a/${H64}.md.txt`, // double extension
      `a/${H64}.markdown1`, // extension over 8 chars
      `a/${H64.slice(0, 50)}.md`, // not 40 or 64
      `a/${H64}0.md`, // 65
      `a/${H64.toUpperCase()}.md`, // digests are lowercase
      `https://example.com/files/${H64}.md`, // a URL path
      `https://example.com/x?f=/a/${H64}.md`, // in a query
      `/a/${H64}.md?k=1`, // query on the segment
      `a/${H64}.md ${H40}`, // a second, bare token beside a masked name
    ]) expect(slug(t)).not.toBeNull();
  });

  test("other secret shapes inside a masked line are still caught", () => {
    expect(slug(`a/${H64}.md ghp-abcdefghijklmnopqrstuvwx`)).not.toBeNull();
  });

  test("Vigil's non-slug check is unchanged", () => {
    expect(credentialRefusal(`artifacts/${H64}.md`)).not.toBeNull();
  });

  test("masking keeps the extension and leaves URLs alone", () => {
    expect(maskContentAddresses(`a/${H64}.md`)).toBe("a/content-address.md");
    expect(maskContentAddresses(`https://x.io/${H64}.md`)).toBe(`https://x.io/${H64}.md`);
  });
});
