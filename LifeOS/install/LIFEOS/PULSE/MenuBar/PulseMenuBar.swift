import AppKit
import Foundation

// ============================================================================
// LifeOS Pulse — menu bar app
//
// Rich dropdown: a per-subsystem counts row over a chronological activity feed
// (Synapse, Conduit, Memory, Work, System), fed by the Pulse endpoint /api/menubar.
// A numeric badge on the icon counts unseen feed events since the menu was last
// opened; opening the menu clears it. Falls back to a direct state.json read when
// the Pulse API is unreachable, so the menu always opens.
// ============================================================================

// Configured Pulse port: PULSE_PORT env -> first `port =` line in PULSE.toml -> 31337 (#2392).
func configuredPulsePort() -> String {
    if let env = ProcessInfo.processInfo.environment["PULSE_PORT"], let n = Int(env), (1...65535).contains(n) { return env }
    let tomlPath = FileManager.default.homeDirectoryForCurrentUser.path + "/.claude/LIFEOS/PULSE/PULSE.toml"
    if let content = try? String(contentsOfFile: tomlPath, encoding: .utf8) {
        for line in content.split(separator: "\n") {
            let t = line.trimmingCharacters(in: .whitespaces)
            if t.hasPrefix("port"), let eq = t.firstIndex(of: "=") {
                let val = t[t.index(after: eq)...].trimmingCharacters(in: .whitespaces)
                if let n = Int(val), (1...65535).contains(n) { return val }
            }
        }
    }
    return "31337"
}
let PULSE_PORT_CFG = configuredPulsePort()
let PULSE_API = "http://localhost:\(PULSE_PORT_CFG)/api/menubar"
let PULSE_DASHBOARD = "http://localhost:\(PULSE_PORT_CFG)"
let LAST_SEEN_KEY = "lifeos.pulse.menubar.lastSeenMs"

// MARK: - /api/menubar payload

struct MenuBarPayload: Codable {
    let daemon: Daemon
    let counts: Counts
    /// Optional so a Pulse that predates the sidecar block still decodes — this
    /// struct decodes all-or-nothing, and a missing key would drop the whole menu
    /// into offline mode.
    let hermes: Hermes?
    let feed: [FeedItem]

    struct Daemon: Codable {
        let status: String
        let label: String
        let uptimeSec: Double
        let failingJobs: Int
        let jobCount: Int
    }
    struct Counts: Codable {
        let amber: Int
        let conduitMinutes: Int
        let memory: Int
        let memoryPending: Int
        let work: Int
    }
    struct Hermes: Codable {
        let status: String
        let summary: String
        let channels: String
    }
    struct FeedItem: Codable {
        let subsystem: String
        let glyph: String
        let title: String
        let tsMs: Double
        let ago: String
        let actionable: Bool
    }
}

// MARK: - Offline fallback state (state.json)

struct PulseState: Codable {
    let version: Int
    let jobs: [String: JobState]
    let startedAt: Double
    struct JobState: Codable {
        let lastRun: Double
        let lastResult: String
        let consecutiveFailures: Int
    }
}

struct HeartbeatJob {
    let name: String
    let schedule: String
    let type: String
    let enabled: Bool
}

// MARK: - Formatting helpers

func formatDuration(_ seconds: TimeInterval) -> String {
    let s = Int(seconds)
    if s < 60 { return "\(s)s" }
    let m = s / 60
    if m < 60 { return "\(m)m" }
    let h = m / 60
    let rm = m % 60
    if h < 24 { return "\(h)h \(rm)m" }
    let d = h / 24
    return "\(d)d \(h % 24)h"
}

func cronToHuman(_ expr: String) -> String {
    let parts = expr.trimmingCharacters(in: .whitespaces).split(separator: " ").map(String.init)
    guard parts.count == 5 else { return expr }
    let (minute, hour, dom, month, dow) = (parts[0], parts[1], parts[2], parts[3], parts[4])
    if minute.hasPrefix("*/"), hour == "*", dom == "*", month == "*", dow == "*" {
        return "every \(String(minute.dropFirst(2)))min"
    }
    if dom == "*", month == "*", dow == "*", !hour.contains("*"), !minute.contains("*"),
       let h = Int(hour), let m = Int(minute) {
        let ampm = h >= 12 ? "pm" : "am"
        let displayH = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        return m == 0 ? "daily at \(displayH)\(ampm)" : "daily at \(displayH):\(String(format: "%02d", m))\(ampm)"
    }
    return expr
}

func parseHeartbeatJobs(from path: String) -> [HeartbeatJob] {
    let fm = FileManager.default
    guard let data = fm.contents(atPath: path),
          let content = String(data: data, encoding: .utf8) else { return [] }
    var jobs: [HeartbeatJob] = []
    var currentJob: [String: String]? = nil
    func flush() {
        if let job = currentJob, let name = job["name"], let schedule = job["schedule"] {
            jobs.append(HeartbeatJob(name: name, schedule: schedule, type: job["type"] ?? "script", enabled: job["enabled"] != "false"))
        }
    }
    for line in content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
        if trimmed == "[[job]]" { flush(); currentJob = [:]; continue }
        guard currentJob != nil else { continue }
        let parts = trimmed.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2 else { continue }
        var value = parts[1]
        if value.hasPrefix("\"") && value.hasSuffix("\"") && value.count >= 2 { value = String(value.dropFirst().dropLast()) }
        currentJob?[parts[0]] = value
    }
    flush()
    return jobs
}

/// Offline status label from state.json (used only when the Pulse API is unreachable).
func offlineStatus(pulseDir: String) -> (label: String, color: NSColor, state: PulseState?) {
    let fm = FileManager.default
    let statePath = "\(pulseDir)/state/state.json"
    guard fm.fileExists(atPath: statePath),
          let attrs = try? fm.attributesOfItem(atPath: statePath),
          let modDate = attrs[.modificationDate] as? Date,
          let data = fm.contents(atPath: statePath),
          let state = try? JSONDecoder().decode(PulseState.self, from: data)
    else { return ("Stopped", .systemGray, nil) }

    var alive = false
    if let pidData = fm.contents(atPath: "\(pulseDir)/state/pulse.pid"),
       let pidStr = String(data: pidData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
       let pid = Int32(pidStr) { alive = kill(pid, 0) == 0 }

    let age = Date().timeIntervalSince(modDate)
    if !alive && age > 120 { return ("Stopped", .systemGray, state) }
    let failing = state.jobs.values.filter { $0.consecutiveFailures >= 3 }.count
    if failing > 0 { return ("Failing — \(failing) job\(failing == 1 ? "" : "s")", .systemRed, state) }
    if age > 120 { return ("Running — tick stale", .systemYellow, state) }
    let uptime = Date().timeIntervalSince1970 - state.startedAt / 1000
    return ("Running — \(formatDuration(uptime))", .systemGreen, state)
}

func statusColor(_ status: String) -> NSColor {
    switch status {
    case "running": return .systemGreen
    case "stale": return .systemYellow
    case "failing": return .systemRed
    default: return .systemGray
    }
}

/// Sidecar states are its own vocabulary — `flapping` has no daemon equivalent
/// and is the one worth seeing, so it gets its own colour rather than the
/// default gray a shared mapper would give it.
func hermesColor(_ status: String) -> NSColor {
    switch status {
    case "up": return .systemGreen
    case "degraded": return .systemYellow
    case "flapping": return .systemOrange
    case "down": return .systemRed
    default: return .systemGray
    }
}

// MARK: - App Delegate

class PulseMenuBarApp: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private var pollTimer: Timer?
    private var payload: MenuBarPayload?
    private var apiReachable = false

    private let pulseDir: String
    private let pollInterval: TimeInterval = 5.0

    override init() {
        self.pulseDir = ProcessInfo.processInfo.environment["LIFEOS_PULSE_DIR"]
            ?? NSString(string: "~/.claude/LIFEOS/PULSE").expandingTildeInPath
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        updateIcon()
        rebuildMenu()
        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            self?.fetchAndRefresh()
        }
        fetchAndRefresh()
    }

    // MARK: - Fetch

    private func fetchAndRefresh() {
        guard let url = URL(string: PULSE_API) else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4.0
        URLSession.shared.dataTask(with: req) { [weak self] data, resp, _ in
            guard let self = self else { return }
            var newPayload: MenuBarPayload? = nil
            if let http = resp as? HTTPURLResponse, http.statusCode == 200, let data = data {
                newPayload = try? JSONDecoder().decode(MenuBarPayload.self, from: data)
            }
            DispatchQueue.main.async {
                self.apiReachable = (newPayload != nil)
                if let p = newPayload { self.payload = p }
                self.updateIcon()
                self.rebuildMenu()
            }
        }.resume()
    }

    // MARK: - Unseen badge accounting

    private var lastSeenMs: Double {
        // Absent → 0, so on first launch the whole feed counts as unseen and the badge
        // is immediately meaningful. Cleared to `now` the first time the menu is opened.
        return UserDefaults.standard.double(forKey: LAST_SEEN_KEY)
    }

    private func unseenCount() -> Int {
        guard let feed = payload?.feed else { return 0 }
        let seen = lastSeenMs
        return feed.filter { $0.tsMs > seen }.count
    }

    private func markSeen() {
        UserDefaults.standard.set(Date().timeIntervalSince1970 * 1000, forKey: LAST_SEEN_KEY)
    }

    // MARK: - Icon (LifeOS glyph + numeric badge)

    private func baseIcon() -> NSImage {
        let iconPath = Bundle.main.path(forResource: "icon@2x", ofType: "png")
            ?? Bundle.main.path(forResource: "icon", ofType: "png")
        if let path = iconPath, let image = NSImage(contentsOfFile: path) {
            image.isTemplate = false
            return image
        }
        let color = apiReachable ? statusColor(payload?.daemon.status ?? "stopped") : offlineStatus(pulseDir: pulseDir).color
        let fallback = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: "LifeOS Pulse")
        let cfg = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)
        let img = fallback?.withSymbolConfiguration(cfg) ?? NSImage()
        // tint
        let tinted = NSImage(size: NSSize(width: 18, height: 18))
        tinted.lockFocus()
        color.set()
        let rect = NSRect(x: 0, y: 0, width: 18, height: 18)
        img.draw(in: rect)
        rect.fill(using: .sourceAtop)
        tinted.unlockFocus()
        return tinted
    }

    private func updateIcon() {
        guard let button = statusItem.button else { return }
        let badge = unseenCount()
        let base = baseIcon()
        let glyphSize: CGFloat = 18
        let width: CGFloat = badge > 0 ? glyphSize + 8 : glyphSize
        let composed = NSImage(size: NSSize(width: width, height: glyphSize))
        composed.lockFocus()
        base.draw(in: NSRect(x: 0, y: 0, width: glyphSize, height: glyphSize),
                  from: .zero, operation: .sourceOver, fraction: 1.0)
        if badge > 0 {
            let txt = badge > 99 ? "99+" : "\(badge)"
            let d: CGFloat = 13
            let bx = width - d
            let by = glyphSize - d
            let circle = NSBezierPath(ovalIn: NSRect(x: bx, y: by, width: d, height: d))
            NSColor.systemRed.setFill()
            circle.fill()
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.boldSystemFont(ofSize: badge > 9 ? 7 : 8.5),
                .foregroundColor: NSColor.white,
            ]
            let s = NSAttributedString(string: txt, attributes: attrs)
            let ssz = s.size()
            s.draw(at: NSPoint(x: bx + (d - ssz.width) / 2, y: by + (d - ssz.height) / 2 - 0.5))
        }
        composed.unlockFocus()
        composed.isTemplate = false
        button.image = composed
    }

    // MARK: - Menu

    private func disabledItem(_ title: String, indent: Int = 0, color: NSColor? = nil, size: CGFloat = 12) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        item.indentationLevel = indent
        var attrs: [NSAttributedString.Key: Any] = [.font: NSFont.menuFont(ofSize: size)]
        if let c = color { attrs[.foregroundColor] = c }
        item.attributedTitle = NSAttributedString(string: title, attributes: attrs)
        return item
    }

    private func rebuildMenu() {
        let menu = NSMenu()
        menu.delegate = self

        // Header
        let header = NSMenuItem(title: "LifeOS Pulse", action: nil, keyEquivalent: "")
        header.attributedTitle = NSAttributedString(string: "LifeOS Pulse",
            attributes: [.font: NSFont.boldSystemFont(ofSize: 13)])
        menu.addItem(header)

        // Status line with colored dot
        let statusLabel: String
        let dotColor: NSColor
        if apiReachable, let d = payload?.daemon {
            statusLabel = d.label
            dotColor = statusColor(d.status)
        } else {
            let off = offlineStatus(pulseDir: pulseDir)
            statusLabel = apiReachable ? off.label : "\(off.label)  ·  API offline"
            dotColor = off.color
        }
        let statusItemLine = NSMenuItem(title: statusLabel, action: nil, keyEquivalent: "")
        statusItemLine.isEnabled = false
        statusItemLine.indentationLevel = 1
        let dot = NSAttributedString(string: "● ", attributes: [.foregroundColor: dotColor, .font: NSFont.menuFont(ofSize: 11)])
        let rest = NSAttributedString(string: statusLabel, attributes: [.foregroundColor: NSColor.secondaryLabelColor, .font: NSFont.menuFont(ofSize: 11)])
        let combined = NSMutableAttributedString(); combined.append(dot); combined.append(rest)
        statusItemLine.attributedTitle = combined
        menu.addItem(statusItemLine)

        menu.addItem(NSMenuItem.separator())

        // Counts row + activity feed (only when API reachable)
        if apiReachable, let p = payload {
            var countBits: [String] = []
            countBits.append("Synapse \(p.counts.amber)")
            countBits.append("Conduit \(p.counts.conduitMinutes)m")
            var memBit = "Mem \(p.counts.memory)"
            if p.counts.memoryPending > 0 { memBit += " · \(p.counts.memoryPending) pending" }
            countBits.append(memBit)
            countBits.append("Work \(p.counts.work)")
            let countsItem = disabledItem(countBits.joined(separator: "    "), indent: 1, color: .labelColor, size: 12)
            menu.addItem(countsItem)

            // Hermes sidecar — separate process tree, so it gets its own row
            // rather than a count. Absent means not installed: no row at all.
            // `summary` already names the channel count when there is one, so the
            // separate `channels` field stays out of this row rather than
            // repeating it.
            if let h = p.hermes, h.status != "absent" {
                menu.addItem(disabledItem("Hermes  \(h.summary)", indent: 1, color: hermesColor(h.status), size: 12))
            }

            menu.addItem(NSMenuItem.separator())
            menu.addItem(disabledItem("RECENT", indent: 1, color: .tertiaryLabelColor, size: 10))

            if p.feed.isEmpty {
                menu.addItem(disabledItem("Quiet — nothing recent", indent: 1, color: .tertiaryLabelColor))
            } else {
                for f in p.feed.prefix(10) {
                    let line = "\(f.glyph)  \(f.title)"
                    let item = NSMenuItem(title: line, action: nil, keyEquivalent: "")
                    item.isEnabled = false
                    item.indentationLevel = 1
                    let color: NSColor = f.actionable ? .systemOrange : .labelColor
                    let attr = NSMutableAttributedString(
                        string: line,
                        attributes: [.font: NSFont.menuFont(ofSize: 12), .foregroundColor: color])
                    attr.append(NSAttributedString(
                        string: "   \(f.ago)",
                        attributes: [.font: NSFont.menuFont(ofSize: 10), .foregroundColor: NSColor.tertiaryLabelColor]))
                    item.attributedTitle = attr
                    menu.addItem(item)
                }
            }
            menu.addItem(NSMenuItem.separator())
        }

        // Open dashboard
        let dash = NSMenuItem(title: "Open Pulse Dashboard", action: #selector(openDashboard), keyEquivalent: "d")
        dash.target = self
        menu.addItem(dash)

        // Jobs submenu (full detail preserved)
        let jobs = parseHeartbeatJobs(from: "\(pulseDir)/PULSE.toml")
        if !jobs.isEmpty {
            let state = apiReachable ? offlineStatus(pulseDir: pulseDir).state : offlineStatus(pulseDir: pulseDir).state
            let jobsItem = NSMenuItem(title: "Jobs (\(jobs.count))", action: nil, keyEquivalent: "")
            let sub = NSMenu()
            for job in jobs {
                let js = state?.jobs[job.name]
                var info = cronToHuman(job.schedule)
                if let js = js, js.consecutiveFailures > 0 { info += "  ·  \(js.consecutiveFailures)x fail" }
                let mark = !job.enabled ? "○" : (js?.consecutiveFailures ?? 0) >= 3 ? "●" : "•"
                let line = "\(mark)  \(job.name)  —  \(info)"
                let it = NSMenuItem(title: line, action: nil, keyEquivalent: "")
                it.isEnabled = false
                let color: NSColor = !job.enabled ? .tertiaryLabelColor : ((js?.consecutiveFailures ?? 0) >= 3 ? .systemRed : .labelColor)
                it.attributedTitle = NSAttributedString(string: line, attributes: [.foregroundColor: color, .font: NSFont.menuFont(ofSize: 12)])
                sub.addItem(it)
            }
            jobsItem.submenu = sub
            menu.addItem(jobsItem)
        }

        menu.addItem(NSMenuItem.separator())

        // Daemon controls (based on best status we have)
        let isStopped = (apiReachable ? payload?.daemon.status : nil) == "stopped"
            || (!apiReachable && offlineStatus(pulseDir: pulseDir).color == .systemGray)
        if isStopped {
            let start = NSMenuItem(title: "Start Pulse", action: #selector(startPulse), keyEquivalent: "s")
            start.target = self; menu.addItem(start)
        } else {
            let restart = NSMenuItem(title: "Restart Pulse", action: #selector(restartPulse), keyEquivalent: "r")
            restart.target = self; menu.addItem(restart)
            let stop = NSMenuItem(title: "Stop Pulse", action: #selector(stopPulse), keyEquivalent: "")
            stop.target = self; menu.addItem(stop)
        }

        let logs = NSMenuItem(title: "Open Logs…", action: #selector(openLogs), keyEquivalent: "l")
        logs.target = self; menu.addItem(logs)
        let cfg = NSMenuItem(title: "Open PULSE.toml…", action: #selector(openHeartbeat), keyEquivalent: ",")
        cfg.target = self; menu.addItem(cfg)

        menu.addItem(NSMenuItem.separator())
        let quit = NSMenuItem(title: "Quit Menu Bar", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self; menu.addItem(quit)

        statusItem.menu = menu
    }

    // MARK: - NSMenuDelegate — clear badge on open

    func menuWillOpen(_ menu: NSMenu) {
        markSeen()
        updateIcon()          // badge clears immediately
        fetchAndRefresh()     // freshest content while open
    }

    // MARK: - Actions

    @objc private func openDashboard() {
        if let url = URL(string: PULSE_DASHBOARD) { NSWorkspace.shared.open(url) }
    }
    @objc private func startPulse() { runManageScript(command: "start") }
    @objc private func stopPulse() { runManageScript(command: "stop") }
    @objc private func restartPulse() { runManageScript(command: "restart") }

    @objc private func openLogs() {
        let fm = FileManager.default
        let logPath = "\(pulseDir)/logs/pulse-stdout.log"
        if fm.fileExists(atPath: logPath) { NSWorkspace.shared.open(URL(fileURLWithPath: logPath)) }
        else if fm.fileExists(atPath: "\(pulseDir)/logs") { NSWorkspace.shared.open(URL(fileURLWithPath: "\(pulseDir)/logs")) }
    }
    @objc private func openHeartbeat() {
        NSWorkspace.shared.open(URL(fileURLWithPath: "\(pulseDir)/PULSE.toml"))
    }
    @objc private func quitApp() { NSApplication.shared.terminate(nil) }

    private func runManageScript(command: String) {
        let scriptPath = "\(pulseDir)/manage.sh"
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/bash")
            process.arguments = [scriptPath, command]
            process.environment = ProcessInfo.processInfo.environment
            try? process.run()
            process.waitUntilExit()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { self?.fetchAndRefresh() }
        }
    }
}

// MARK: - Entry Point

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = PulseMenuBarApp()
app.delegate = delegate
app.run()
