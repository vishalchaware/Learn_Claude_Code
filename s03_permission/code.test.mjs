import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkDenyList,
  checkPermission,
  checkRules,
  containsDestructiveCommand,
} from "./code.mjs";

test("hard deny list blocks a forbidden bash command", () => {
  assert.equal(checkDenyList("sudo command"), "Blocked: 'sudo' is on the deny list");
  assert.equal(checkDenyList("echo hello"), null);
});

test("destructive command detection recognizes rm and del commands, not words", () => {
  assert.equal(containsDestructiveCommand("rm test.txt"), true);
  assert.equal(containsDestructiveCommand("echo del test.txt"), false);
  assert.equal(containsDestructiveCommand("model"), false);
  assert.equal(containsDestructiveCommand("echo ok && DEL test.txt"), true);
});

test("permission rules require approval for destructive commands and outside paths", () => {
  assert.equal(checkRules("bash", { command: "rm test.txt" }), "Potentially destructive command");
  assert.equal(checkRules("bash", { command: "echo hello" }), null);
  assert.equal(
    checkRules("write_file", { path: "../outside.txt" }, "/workspace/project"),
    "Writing outside workspace",
  );
  assert.equal(
    checkRules("write_file", { path: "src/file.txt" }, "/workspace/project"),
    null,
  );
});

test("permission pipeline blocks hard denials and asks before rule-matched tools", async () => {
  let approvalRequests = 0;
  const askUser = async () => {
    approvalRequests += 1;
    return "deny";
  };

  assert.equal(
    await checkPermission({ name: "bash", input: { command: "sudo whoami" } }, askUser),
    false,
  );
  assert.equal(approvalRequests, 0);

  assert.equal(
    await checkPermission({ name: "bash", input: { command: "rm test.txt" } }, askUser),
    false,
  );
  assert.equal(approvalRequests, 1);
});

test("rule-matched tool calls continue only after approval", async () => {
  const allowed = await checkPermission(
    { name: "write_file", input: { path: "../outside.txt" } },
    async () => "allow",
    "/workspace/project",
  );
  assert.equal(allowed, true);
});

test("outside-workspace paths remain detectable when the workspace exists", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "s03-permission-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, "workspace");
  await mkdir(workspace);
  await writeFile(path.join(root, "outside.txt"), "outside");

  assert.equal(
    checkRules("read_file", { path: "../outside.txt" }, workspace),
    "Writing outside workspace",
  );
});
