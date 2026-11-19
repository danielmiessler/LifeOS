// Tests for the systemd source of the Workflows inventory.
// On Linux, scheduled work lives in systemd user timers; the inventory only read macOS plists.
import { describe, expect, test } from "bun:test";
import { collectSystemd, parseShow, timerTrigger } from "./systemd.ts";

const shown = (p: string) => p.replace("/home/u", "~");

describe("timerTrigger", () => {
  test("daily OnCalendar with a time → daily cron", () => {
    const t = timerTrigger("[Timer]\nOnCalendar=*-*-* 08:30:00\nPersistent=true\n");
    expect(t.kind).toBe("schedule");
    expect(t.expr).toBe("30 8 * * *");
    expect(t.periodMinutes).toBe(1440);
  });
  test("OnCalendar without seconds and with a weekday", () => {
    const t = timerTrigger("[Timer]\nOnCalendar=Fri *-*-* 21:15\n");
    expect(t.expr).toBe("15 21 * * 5");
  });
  test("daily and hourly shorthands", () => {
    expect(timerTrigger("[Timer]\nOnCalendar=daily\n").expr).toBe("0 0 * * *");
    expect(timerTrigger("[Timer]\nOnCalendar=hourly\n").expr).toBe("0 * * * *");
  });
  test("OnUnitActiveSec in minutes → every N minutes", () => {
    const t = timerTrigger("[Timer]\nOnBootSec=2min\nOnUnitActiveSec=5min\n");
    expect(t.kind).toBe("schedule");
    expect(t.periodMinutes).toBe(5);
    expect(t.expr).toBe("300s");
  });
  test("OnUnitActiveSec in hours and in bare seconds", () => {
    expect(timerTrigger("[Timer]\nOnUnitActiveSec=1h\n").periodMinutes).toBe(60);
    expect(timerTrigger("[Timer]\nOnUnitActiveSec=90\n").periodMinutes).toBe(1.5);
  });
  test("a one-off date stays a schedule with the raw expression and no period", () => {
    const t = timerTrigger("[Timer]\nOnCalendar=2026-11-13 21:15:00\n");
    expect(t.kind).toBe("schedule");
    expect(t.expr).toBe("2026-11-13 21:15:00");
    expect(t.display).toBe("2026-11-13 21:15:00");
    expect(t.periodMinutes).toBeNull();
  });
  test("no trigger → on-demand", () => {
    const t = timerTrigger("[Timer]\nPersistent=true\n");
    expect(t.kind).toBe("on-demand");
  });
});

describe("parseShow", () => {
  test("blocks separated by a blank line, keyed by Id", () => {
    const m = parseShow("Id=a.timer\nUnitFileState=enabled\n\nId=a.service\nResult=success\nDescription=Does A\n");
    expect(m["a.timer"]?.UnitFileState).toBe("enabled");
    expect(m["a.service"]?.Result).toBe("success");
    expect(m["a.service"]?.Description).toBe("Does A");
  });
  test("a value containing an equals sign is kept whole", () => {
    expect(parseShow("Id=b.service\nDescription=x=y\n")["b.service"]?.Description).toBe("x=y");
  });
});

const SHOW = [
  "Id=ok.timer", "UnitFileState=enabled", "ActiveState=active", "LastTriggerUSec=Wed 2026-11-18 08:30:00 -03", "Description=Timer for ok", "",
  "Id=ok.service", "Result=success", "Description=Runs ok",  "",
  "Id=broken.timer", "UnitFileState=enabled", "ActiveState=active", "LastTriggerUSec=Wed 2026-11-18 09:00:00 -03", "",
  "Id=broken.service", "Result=exit-code", "",
  "Id=disabled.timer", "UnitFileState=disabled", "ActiveState=inactive", "LastTriggerUSec=n/a", "",
  "Id=disabled.service", "Result=success", "",
].join("\n");

describe("collectSystemd", () => {
  const timers = [
    { name: "ok.timer", text: "[Unit]\nDescription=Timer for ok\n[Timer]\nOnCalendar=*-*-* 08:30\n" },
    { name: "broken.timer", text: "[Timer]\nOnUnitActiveSec=15min\n" },
    { name: "disabled.timer", text: "[Timer]\nOnCalendar=daily\n" },
  ];
  const recs = collectSystemd("/home/u/.config/systemd/user", timers, SHOW, shown);
  const by = (n: string) => recs.find((r) => r.name === n)!;

  test("one record per timer, runtime systemd, id systemd:<name without .timer>", () => {
    expect(recs.length).toBe(3);
    expect(by("ok").id).toBe("systemd:ok");
    expect(by("ok").runtime).toBe("systemd");
    expect(by("ok").declared).toBe(true);
  });
  test("the title is the service description, or the name when there is none", () => {
    expect(by("ok").title).toBe("Runs ok");
    expect(by("broken").title).toBe("broken");
  });
  test("definedIn points at the .timer file with home shown as ~", () => {
    expect(by("ok").definedIn).toBe("~/.config/systemd/user/ok.timer");
  });
  test("installed and enabled as systemd reports them", () => {
    expect(by("ok").installed).toBe("loaded");
    expect(by("ok").enabled).toBe(true);
    expect(by("disabled").installed).toBe("on-disk");
    expect(by("disabled").enabled).toBe(false);
  });
  test("the last run and its result come from the service", () => {
    expect(by("ok").evidence.lastStatus).toBe("ok");
    expect(by("ok").evidence.lastRunAt).toBe("2026-11-18T11:30:00.000Z");
    expect(by("broken").evidence.lastStatus).toBe("error");
    expect(by("disabled").evidence.lastStatus).toBe("unknown");
    expect(by("disabled").evidence.lastRunAt).toBeNull();
  });
  test("the trigger comes from the timer file", () => {
    expect(by("ok").trigger.expr).toBe("30 8 * * *");
    expect(by("broken").trigger.periodMinutes).toBe(15);
  });
});
