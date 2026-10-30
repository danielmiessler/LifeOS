import { describe, expect, test } from "bun:test";
import { permissionRuleRejectionReason, prunePermissionRules } from "./MergeSettings";

describe("mcp permission rule shape", () => {
  test("bare mcp__<server> is valid (Claude Code: matches every tool from that server)", () => {
    expect(permissionRuleRejectionReason("mcp__puppeteer")).toBeNull();
    expect(permissionRuleRejectionReason("mcp__plugin_my-plugin_database-tools")).toBeNull();
  });

  test("server-wide glob and single-tool forms stay valid", () => {
    expect(permissionRuleRejectionReason("mcp__puppeteer__*")).toBeNull();
    expect(permissionRuleRejectionReason("mcp__github__get_*")).toBeNull();
    expect(permissionRuleRejectionReason("mcp__puppeteer__puppeteer_navigate")).toBeNull();
  });

  test("a glob or empty name in the server position is still rejected", () => {
    expect(permissionRuleRejectionReason("mcp__")).not.toBeNull();
    expect(permissionRuleRejectionReason("mcp__*")).not.toBeNull();
    expect(permissionRuleRejectionReason("mcp__pup*")).not.toBeNull();
    expect(permissionRuleRejectionReason("mcp__*__navigate")).not.toBeNull();
  });

  test("a bare-server deny rule survives the prune", () => {
    const settings = { permissions: { allow: ["mcp__puppeteer"], deny: ["mcp__dangerous"], ask: [] } };
    expect(prunePermissionRules(settings)).toEqual([]);
    expect(settings.permissions.deny).toEqual(["mcp__dangerous"]);
    expect(settings.permissions.allow).toEqual(["mcp__puppeteer"]);
  });
});
