import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DISPATCHER_UNIT, dispatcherUnit, ensureDispatcher, installDispatcher, uninstallDispatcher, uninstallSchedule, type Systemctl } from "./schedule-install.ts";

/** A systemctl that records every call and answers is-active from a flag the test controls. */
function recorder(active = { value: true }): { systemctl: Systemctl; calls: string[][] } {
  const calls: string[][] = [];
  const systemctl: Systemctl = args => {
    calls.push(args);
    if (args[0] === "is-active") return { code: active.value ? 0 : 3, stderr: "" };
    return { code: 0, stderr: "" };
  };
  return { systemctl, calls };
}

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "wf-linux-"));
  return { root, home: root, systemdUserDir: join(root, "systemd-user"), launchAgentsDir: join(root, "LaunchAgents"), servicesPath: join(root, "services.json") };
}

describe("Linux dispatcher (systemd user service)", () => {
  test("install writes the unit, reloads, enables and restarts it, and reports it loaded", () => {
    const s = sandbox();
    const { systemctl, calls } = recorder();
    const r = installDispatcher({ platform: "linux", home: s.home, systemdUserDir: s.systemdUserDir, systemctl, env: {} });
    expect(r.loaded).toBe(true);
    expect(r.plistPath).toBe(join(s.systemdUserDir, DISPATCHER_UNIT));
    const unit = readFileSync(r.plistPath, "utf8");
    expect(unit).toContain("dispatcher.ts\" serve");
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("KillMode=process");
    expect(unit).toContain("WantedBy=default.target");
    expect(calls).toEqual([["daemon-reload"], ["enable", DISPATCHER_UNIT], ["restart", DISPATCHER_UNIT], ["is-active", "--quiet", DISPATCHER_UNIT]]);
    expect(existsSync(s.launchAgentsDir)).toBe(false);
  });

  test("ensure leaves a current, running unit alone and reinstalls a stopped one", () => {
    const s = sandbox();
    const active = { value: true };
    const first = recorder(active);
    installDispatcher({ platform: "linux", home: s.home, systemdUserDir: s.systemdUserDir, systemctl: first.systemctl, env: {} });
    const again = recorder(active);
    ensureDispatcher({ platform: "linux", home: s.home, systemdUserDir: s.systemdUserDir, systemctl: again.systemctl, env: {} });
    expect(again.calls).toEqual([["is-active", "--quiet", DISPATCHER_UNIT]]);
    active.value = false;
    const stopped = recorder(active);
    ensureDispatcher({ platform: "linux", home: s.home, systemdUserDir: s.systemdUserDir, systemctl: stopped.systemctl, env: {} });
    expect(stopped.calls.map(c => c[0])).toContain("restart");
  });

  test("uninstalling a workflow on Linux calls neither launchctl nor systemctl and creates no LaunchAgents directory", () => {
    const s = sandbox();
    writeFileSync(s.servicesPath, "[]\n");
    const { systemctl, calls } = recorder();
    let launchctlCalled = false;
    const r = uninstallSchedule("anything", { platform: "linux", launchAgentsDir: s.launchAgentsDir, servicesPath: s.servicesPath, systemctl, launchctl: () => { launchctlCalled = true; return { code: 0, stderr: "" }; } });
    expect(r.removedPlist).toBe(false);
    expect(launchctlCalled).toBe(false);
    expect(calls).toEqual([]);
    expect(existsSync(s.launchAgentsDir)).toBe(false);
  });

  test("uninstalling the dispatcher disables it and removes the unit", () => {
    const s = sandbox();
    const { systemctl } = recorder();
    installDispatcher({ platform: "linux", home: s.home, systemdUserDir: s.systemdUserDir, systemctl, env: {} });
    const off = recorder();
    const r = uninstallDispatcher({ platform: "linux", systemdUserDir: s.systemdUserDir, systemctl: off.systemctl } as never);
    expect(r.removedPlist).toBe(true);
    expect(existsSync(join(s.systemdUserDir, DISPATCHER_UNIT))).toBe(false);
    expect(off.calls[0]).toEqual(["disable", "--now", DISPATCHER_UNIT]);
  });

  test("unit values escape systemd specifiers and quotes", () => {
    const unit = dispatcherUnit({ home: "/home/u", bun: "/opt/b%n/bun", path: "/bin", extraEnv: { LIFEOS_DIR: '/x/"q"/50%' } });
    expect(unit).toContain('ExecStart="/opt/b%%n/bun"');
    expect(unit).toContain('Environment="LIFEOS_DIR=/x/\\"q\\"/50%%"');
  });
});
