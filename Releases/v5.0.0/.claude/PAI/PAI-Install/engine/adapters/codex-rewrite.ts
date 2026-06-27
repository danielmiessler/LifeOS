export const CODEX_REWRITE_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".json",
  ".md",
  ".plist",
  ".sh",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

export function rewriteCodexPaths(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/\$\{HOME\}\/\.claude\/PAI/g, "${HOME}/.pai")
      .replace(/\$HOME\/\.claude\/PAI/g, "$HOME/.pai")
      .replace(/~\/\.claude\/PAI/g, "~/.pai")
      .replace(/(["'])\.claude\1\s*,\s*(["'])PAI\2/g, "$1.pai$1")
      .replace(/\$\{HOME\}\/\.claude/g, "${HOME}/.codex")
      .replace(/\$HOME\/\.claude/g, "$HOME/.codex")
      .replace(/~\/\.claude/g, "~/.codex")
      .replace(/\$HOME\/\.claude\/hooks/g, "$HOME/.codex/hooks")
      .replace(/~\/\.claude\/hooks/g, "~/.codex/hooks")
      .replace(/\$HOME\/\.claude\/skills/g, "$HOME/.codex/skills")
      .replace(/~\/\.claude\/skills/g, "~/.codex/skills")
      .replace(/Claude Code harness/g, "Codex harness")
      .replace(/CLAUDE\.md/g, "AGENTS.md")
      .replace(/\.claude\/PAI/g, ".pai")
      .replace(/(?<![\w.~/$-])PAI\//g, "~/.pai/");
  }
  if (Array.isArray(value)) {
    return value.map(rewriteCodexPaths);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, rewriteCodexPaths(child)]),
    );
  }
  return value;
}
