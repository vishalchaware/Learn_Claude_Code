#!/usr/bin/env node
import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(SCRIPT_DIR, "..");
const WORKDIR = process.cwd();

if (typeof process.loadEnvFile !== "function") {
  throw new Error("Node.js 22 or newer is required.");
}
const envFile = path.join(REPO_DIR, ".env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const MODEL = process.env.MODEL_ID;
const MAX_TOOL_OUTPUT = 50_000;
const DENY_LIST = ["rm -rf /", "sudo", "shutdown", "reboot", "mkfs", "dd if=", "> /dev/sda"];
const DESTRUCTIVE_COMMAND_WORD = /(?:^|[;&|()\n])\s*(?:rm|del)(?=\s|$|[;&|()])/i;

const ENVIRONMENT_PROMPT = process.platform === "win32"
  ? "Windows: the bash tool runs through cmd.exe; use cmd.exe syntax, not Unix Bash or PowerShell syntax, and prefer dedicated file tools for file operations"
  : "Unix-like: the bash tool runs the system shell";

const SYSTEM = `You are a coding agent at ${WORKDIR}. Environment: ${ENVIRONMENT_PROMPT}. Use tools to solve tasks. Do not ask for approval yourself. For destructive operations, still request the tool call; the harness will approve or deny before execution.`;

const TOOLS = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, limit: { type: "integer" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in a file once.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "glob",
    description: "Find files matching a glob pattern; ** matches recursively.",
    input_schema: {
      type: "object",
      properties: { pattern: { type: "string" } },
      required: ["pattern"],
    },
  },
];

function isInsideWorkspace(candidate, workdir = WORKDIR) {
  const relative = path.relative(workdir, candidate);
  return relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative));
}

function resolveToolPath(filePath, workdir = WORKDIR) {
  return path.resolve(workdir, filePath);
}

export function checkDenyList(command) {
  for (const pattern of DENY_LIST) {
    if (command.includes(pattern)) {
      return `Blocked: '${pattern}' is on the deny list`;
    }
  }
  return null;
}

export function containsDestructiveCommand(command) {
  return DESTRUCTIVE_COMMAND_WORD.test(command);
}

export function checkRules(toolName, args, workdir = WORKDIR) {
  if (["read_file", "write_file", "edit_file"].includes(toolName)) {
    const candidate = resolveToolPath(args.path ?? "", workdir);
    if (!isInsideWorkspace(candidate, workdir)) {
      return "Writing outside workspace";
    }
  }

  if (toolName === "bash") {
    const command = args.command ?? "";
    if (
      containsDestructiveCommand(command) ||
      ["rm ", "> /etc/", "chmod 777"].some((keyword) => command.includes(keyword))
    ) {
      return "Potentially destructive command";
    }
  }

  return null;
}

export async function checkPermission(block, askUser, workdir = WORKDIR) {
  if (block.name === "bash") {
    const reason = checkDenyList(block.input.command ?? "");
    if (reason) {
      console.log(`\n\x1b[31m[blocked] ${reason}\x1b[0m`);
      return false;
    }
  }

  const reason = checkRules(block.name, block.input, workdir);
  if (reason) {
    return (await askUser(block.name, block.input, reason)) === "allow";
  }
  return true;
}

function runBash(command) {
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: WORKDIR,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdoutText, stderrText) => {
        if (error?.killed) {
          resolve("Error: Timeout (120s)");
          return;
        }
        const output = `${stdoutText}${stderrText}`.trim();
        resolve(
          output
            ? output.slice(0, MAX_TOOL_OUTPUT)
            : error
              ? `Error: ${error.message}`
              : "(no output)",
        );
      },
    );
  });
}

async function runRead(filePath, limit) {
  try {
    const lines = (await readFile(resolveToolPath(filePath), "utf8")).split(/\r?\n/);
    if (limit && limit < lines.length) {
      lines.splice(limit, lines.length - limit, `... (${lines.length - limit} more lines)`);
    }
    return lines.join("\n");
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function runWrite(filePath, content) {
  try {
    const resolved = resolveToolPath(filePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf8");
    return `Wrote ${Buffer.byteLength(content, "utf8")} bytes to ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function runEdit(filePath, oldText, newText) {
  try {
    const resolved = resolveToolPath(filePath);
    const text = await readFile(resolved, "utf8");
    const index = text.indexOf(oldText);
    if (index === -1) {
      return `Error: text not found in ${filePath}`;
    }
    const edited = text.slice(0, index) + newText + text.slice(index + oldText.length);
    await writeFile(resolved, edited, "utf8");
    return `Edited ${filePath}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function runGlob(pattern) {
  try {
    const matches = [];
    for await (const match of glob(pattern, { cwd: WORKDIR })) {
      if (isInsideWorkspace(resolveToolPath(match))) {
        matches.push(match);
      }
    }
    matches.sort();
    const shown = matches.slice(0, 200);
    if (matches.length > 200) {
      shown.push("... (more matches omitted; narrow the pattern)");
    }
    return shown.join("\n") || "(no matches)";
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

const TOOL_HANDLERS = {
  bash: ({ command }) => runBash(command),
  read_file: ({ path: filePath, limit }) => runRead(filePath, limit),
  write_file: ({ path: filePath, content }) => runWrite(filePath, content),
  edit_file: ({ path: filePath, old_text: oldText, new_text: newText }) =>
    runEdit(filePath, oldText, newText),
  glob: ({ pattern }) => runGlob(pattern),
};

function messagesEndpoint() {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const normalized = baseUrl.replace(/\/+$/, "");
  if (normalized.endsWith("/v1/messages")) {
    return normalized;
  }
  return normalized.endsWith("/v1")
    ? `${normalized}/messages`
    : `${normalized}/v1/messages`;
}

async function createMessage(messages) {
  if (!MODEL) {
    throw new Error("MODEL_ID is not set. Add it to the repository .env file or environment.");
  }

  const customBaseUrl = Boolean(process.env.ANTHROPIC_BASE_URL);
  const apiKey = process.env.ANTHROPIC_API_KEY ??
    (!customBaseUrl ? process.env.ANTHROPIC_AUTH_TOKEN : undefined);
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const headers = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(messagesEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: MODEL,
      system: SYSTEM,
      messages,
      tools: TOOLS,
      max_tokens: 8000,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Anthropic API returned ${response.status}: ${body}`);
  }
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Anthropic API returned invalid JSON: ${error.message}`);
  }
}

async function agentLoop(messages, rl) {
  while (true) {
    const response = await createMessage(messages);
    messages.push({ role: "assistant", content: response.content });

    const toolCalls = response.content.filter((block) => block.type === "tool_use");
    if (toolCalls.length === 0) {
      for (const block of response.content) {
        if (block.type === "text") {
          console.log(block.text);
        }
      }
      return;
    }

    const results = [];
    for (const block of toolCalls) {
      console.log(`\x1b[36m> ${block.name}\x1b[0m`);
      const allowed = await checkPermission(
        block,
        async (toolName, args, reason) => {
          console.log(`\n\x1b[33m[permission] ${reason}\x1b[0m`);
          console.log(`   Tool: ${toolName}(${JSON.stringify(args)})`);
          const choice = (await rl.question("   Allow? [y/N] ")).trim().toLowerCase();
          return choice === "y" || choice === "yes" ? "allow" : "deny";
        },
      );

      if (!allowed) {
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Permission denied.",
        });
        continue;
      }

      const handler = TOOL_HANDLERS[block.name];
      const output = handler
        ? await handler(block.input)
        : `Unknown: ${block.name}`;
      console.log(String(output).slice(0, 200));
      results.push({ type: "tool_result", tool_use_id: block.id, content: output });
    }
    messages.push({ role: "user", content: results });
  }
}

export async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("s03: Permission");
  console.log("Enter a question, press Enter to send. Type q to quit.\n");

  const history = [];
  try {
    while (true) {
      let query;
      try {
        query = await rl.question("\x1b[36ms03 >> \x1b[0m");
      } catch (error) {
        if (error.code === "ERR_USE_AFTER_CLOSE") {
          break;
        }
        throw error;
      }
      if (!query.trim()) {
        continue;
      }
      if (["q", "exit"].includes(query.trim().toLowerCase())) {
        break;
      }
      history.push({ role: "user", content: query });
      await agentLoop(history, rl);
      console.log();
    }
  } finally {
    rl.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
