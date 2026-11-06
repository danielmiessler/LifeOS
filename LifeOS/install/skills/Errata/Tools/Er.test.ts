import { describe, expect, test } from "bun:test"
import { parseErArgs } from "./Er.ts"

describe("parseErArgs", () => {
  test("replay of a real miss: --help is never filed as feedback", () => {
    expect(() => parseErArgs(["--help"])).toThrow("unknown option: --help")
  })

  test("a mistyped option before the text stops the run", () => {
    expect(() => parseErArgs(["--prodcut", "bug: the installer assumes zsh"])).toThrow("unknown option: --prodcut")
  })

  test("known options and tagged text parse as before", () => {
    const a = parseErArgs(["--product", "--channel", "feedback-command", "bug: the installer assumes zsh"])
    expect(a).toMatchObject({ product: true, channel: "feedback-command", kind: "bug", text: "the installer assumes zsh" })
  })

  test("a --word inside the text stays part of the text", () => {
    expect(parseErArgs(["the", "--force", "flag", "broke"]).text).toBe("the --force flag broke")
  })
})
