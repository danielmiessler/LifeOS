import { spawn as nodeSpawn, spawnSync as nodeSpawnSync, type ChildProcess } from "child_process";
import { join } from "path";
import { getHarnessHome, getHarnessKind, getPaiDir, type PaiHarness } from "./runtime-paths";

export interface AgentPromptOptions {
  allowedTools?: string;
  codexSandbox?: "read-only" | "workspace-write" | "danger-full-access";
  cwd?: string;
  excludeDynamicSystemPromptSections?: boolean;
  imagePaths?: string[];
  model?: string;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface AgentPromptResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
  timedOut?: boolean;
}

function commandPath(command: "claude" | "codex"): string {
  return Bun.which(command) ?? join(process.env.HOME ?? "~", ".local", "bin", command);
}

function codexModelArgs(model?: string): string[] {
  return model && /^(gpt|o\d|codex)/i.test(model) ? ["--model", model] : [];
}

function codexDeveloperInstructionsArgs(systemPrompt?: string): string[] {
  return systemPrompt
    ? ["--config", `developer_instructions=${JSON.stringify(systemPrompt)}`]
    : [];
}

function codexImageArgs(imagePaths?: string[]): string[] {
  return imagePaths?.flatMap((path) => ["--image", path]) ?? [];
}

function scrubAgentSecretEnv(env: Record<string, string>): Record<string, string> {
  const next = { ...env };
  delete next.ANTHROPIC_API_KEY;
  delete next.ANTHROPIC_AUTH_TOKEN;
  delete next.CLAUDECODE;
  delete next.OPENAI_API_KEY;
  delete next.ELEVENLABS_API_KEY;
  delete next.GEMINI_API_KEY;
  delete next.GOOGLE_API_KEY;
  delete next.GOOGLE_GENAI_API_KEY;
  delete next.XAI_API_KEY;
  delete next.GROK_API_KEY;
  delete next.PERPLEXITY_API_KEY;
  delete next.TELEGRAM_BOT_TOKEN;
  return next;
}

function codexSandboxForOptions(options: AgentPromptOptions): "read-only" | "workspace-write" | "danger-full-access" {
  if (options.codexSandbox) return options.codexSandbox;
  return /\b(Edit|Write|Bash|NotebookEdit)\b/.test(options.allowedTools ?? "")
    ? "workspace-write"
    : "read-only";
}

export function buildPromptInvocation(
  prompt: string,
  options: AgentPromptOptions = {},
  harness: PaiHarness = getHarnessKind(),
): { command: string; args: string[]; input: string; env: Record<string, string>; cwd: string } {
  const cwd = options.cwd ?? getPaiDir();

  if (harness === "codex") {
    return {
      command: commandPath("codex"),
      args: [
        "--ask-for-approval", "never",
        "exec",
        "--skip-git-repo-check",
        "--cd", cwd,
        "--sandbox", codexSandboxForOptions(options),
        "--color", "never",
        ...codexModelArgs(options.model),
        ...codexDeveloperInstructionsArgs(options.systemPrompt),
        ...codexImageArgs(options.imagePaths),
        "-",
      ],
      input: prompt,
      env: scrubAgentSecretEnv({
        ...process.env,
        HOME: process.env.HOME ?? "",
        CODEX_HOME: process.env.CODEX_HOME ?? getHarnessHome(),
        PAI_DIR: getPaiDir(),
        PAI_HARNESS: "codex",
      } as Record<string, string>),
      cwd,
    };
  }

  const hasImages = Boolean(options.imagePaths?.length);
  const toolArgs = hasImages
    ? ["--allowedTools", "Read"]
    : options.allowedTools
      ? ["--allowedTools", options.allowedTools]
      : ["--tools", ""];

  return {
    command: commandPath("claude"),
    args: [
      "--print",
      "--model", options.model ?? "sonnet",
      ...toolArgs,
      "--output-format", "text",
      ...(options.excludeDynamicSystemPromptSections ? ["--exclude-dynamic-system-prompt-sections"] : []),
      "--setting-sources", "",
      ...(options.systemPrompt ? ["--system-prompt", options.systemPrompt] : ["--system-prompt", ""]),
    ],
    input: hasImages
      ? `${options.imagePaths!.map((path) => `@${path}`).join("\n")}\n\n${prompt}`
      : prompt,
    env: scrubAgentSecretEnv({ ...process.env, HOME: process.env.HOME ?? "" } as Record<string, string>),
    cwd,
  };
}

export function getAgentLabel(harness: PaiHarness = getHarnessKind()): string {
  return harness === "codex" ? "Codex" : "Claude Code";
}

export function getAgentCommand(harness: PaiHarness = getHarnessKind()): string {
  return commandPath(harness === "codex" ? "codex" : "claude");
}

export function getAgentVersion(harness: PaiHarness = getHarnessKind()): string | null {
  const result = nodeSpawnSync(getAgentCommand(harness), ["--version"], { encoding: "utf-8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return output || null;
}

export async function runAgentPrompt(
  prompt: string,
  options: AgentPromptOptions = {},
): Promise<AgentPromptResult> {
  const invocation = buildPromptInvocation(prompt, options);
  const proc = Bun.spawn([invocation.command, ...invocation.args], {
    cwd: invocation.cwd,
    stdin: new Blob([invocation.input]),
    stdout: "pipe",
    stderr: "pipe",
    env: invocation.env,
  });

  let timedOut = false;
  const timer = options.timeoutMs === undefined
    ? undefined
    : setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, options.timeoutMs);
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const status = await proc.exited;
  if (timer) clearTimeout(timer);

  return {
    status,
    stdout,
    stderr,
    timedOut,
    error: timedOut ? new Error(`Timeout after ${options.timeoutMs}ms`) : undefined,
  };
}

export function runAgentPromptSync(
  prompt: string,
  options: AgentPromptOptions = {},
): AgentPromptResult {
  const invocation = buildPromptInvocation(prompt, options);
  const spawnOptions = {
    cwd: invocation.cwd,
    env: invocation.env,
    input: invocation.input,
    encoding: "utf-8",
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  } as Parameters<typeof nodeSpawnSync>[2];
  const result = nodeSpawnSync(invocation.command, invocation.args, spawnOptions);

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
    timedOut: result.error?.message.includes("ETIMEDOUT") ?? false,
  };
}

export function spawnInteractiveAgent(
  prompt: string | undefined,
  options: AgentPromptOptions & { resume?: boolean } = {},
): ChildProcess {
  const harness = getHarnessKind();
  const cwd = options.cwd ?? getHarnessHome();

  if (harness === "codex") {
    const configArgs = codexDeveloperInstructionsArgs(options.systemPrompt);
    const sandboxArgs = options.codexSandbox ? ["--sandbox", options.codexSandbox] : [];
    const args = options.resume
      ? ["resume", ...configArgs, ...sandboxArgs, "--last"]
      : [...configArgs, "--cd", cwd, ...sandboxArgs, ...(prompt ? [prompt] : [])];
    return nodeSpawn(commandPath("codex"), args, {
      stdio: "inherit",
      cwd,
      env: {
        ...process.env,
        CODEX_HOME: process.env.CODEX_HOME ?? getHarnessHome(),
        PAI_DIR: getPaiDir(),
        PAI_HARNESS: "codex",
      },
    });
  }

  const args = [
    ...(prompt ? [prompt] : []),
    ...(options.allowedTools ? ["--allowedTools", options.allowedTools] : []),
  ];
  if (options.resume) args.unshift("--resume");

  return nodeSpawn(commandPath("claude"), args, {
    stdio: "inherit",
    cwd,
    env: scrubAgentSecretEnv({ ...process.env, HOME: process.env.HOME ?? "" } as Record<string, string>),
  });
}
