import AppKit
import Foundation

// MARK: - State JSON Model

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

// MARK: - PAI Work Session Model

struct WorkSession: Codable {
    let task: String?
    let sessionName: String?
    let sessionUUID: String?
    let phase: String?
    let progress: String?
    let effort: String?
    let mode: String?
    let started: String?
    let updatedAt: String?
}

struct WorkRegistry: Codable {
    let sessions: [String: WorkSession]
}

// MARK: - PULSE.toml Job Definition

struct HeartbeatJob {
    let name: String
    let schedule: String
    let type: String
    let enabled: Bool
}

// MARK: - Pulse Status

enum PulseStatus {
    case running(uptime: TimeInterval)
    case stale
    case failing(count: Int)
    case stopped

    var iconName: String {
        switch self {
        case .running: return "waveform.path.ecg"
        case .stale: return "waveform.path.ecg"
        case .failing: return "waveform.path.ecg"
        case .stopped: return "waveform.path.ecg"
        }
    }

    var iconColor: NSColor {
        switch self {
        case .running: return .systemGreen
        case .stale: return .systemYellow
        case .failing: return .systemRed
        case .stopped: return .systemGray
        }
    }

    var label: String {
        switch self {
        case .running(let uptime): return "Running -- \(formatDuration(uptime))"
        case .stale: return "Running -- tick stale"
        case .failing(let n): return "Failing -- \(n) job\(n == 1 ? "" : "s") in error"
        case .stopped: return "Stopped"
        }
    }
}

// MARK: - Formatting Helpers

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

func formatAgo(_ epochMs: Double) -> String {
    let secondsAgo = (Date().timeIntervalSince1970 * 1000 - epochMs) / 1000
    if secondsAgo < 0 { return "just now" }
    if secondsAgo < 5 { return "just now" }
    if secondsAgo < 60 { return "\(Int(secondsAgo))s ago" }
    let minutes = Int(secondsAgo) / 60
    if minutes < 60 { return "\(minutes)m ago" }
    let hours = minutes / 60
    return "\(hours)h \(minutes % 60)m ago"
}

// MARK: - Work-session helpers

func formatAgeShort(_ date: Date) -> String {
    let seconds = Date().timeIntervalSince(date)
    if seconds < 0 { return "now" }
    if seconds < 60 { return "\(Int(seconds))s" }
    let minutes = Int(seconds) / 60
    if minutes < 60 { return "\(minutes)m" }
    let hours = minutes / 60
    if hours < 24 { return "\(hours)h" }
    let days = hours / 24
    return "\(days)d"
}

let isoFracFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

let isoPlainFormatter: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

func parseISO(_ s: String?) -> Date? {
    guard let s = s else { return nil }
    if let d = isoFracFormatter.date(from: s) { return d }
    return isoPlainFormatter.date(from: s)
}

func parseWorkRegistry(from path: String) -> [(slug: String, session: WorkSession)] {
    let fm = FileManager.default
    guard fm.fileExists(atPath: path),
          let data = fm.contents(atPath: path),
          let registry = try? JSONDecoder().decode(WorkRegistry.self, from: data) else {
        return []
    }
    return registry.sessions.map { (slug: $0.key, session: $0.value) }
}

let algorithmPhases: Set<String> = ["observe", "think", "plan", "build", "execute", "verify", "learn"]

func sessionIndicator(phase: String?, inRecent: Bool) -> String {
    let p = phase ?? ""
    if inRecent { return "✓" }
    if algorithmPhases.contains(p) { return "⚡" }
    if p == "complete" { return "✓" }
    return "📡"
}

func sessionLabel(_ session: WorkSession, slug: String) -> String {
    let raw = session.task?
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .replacingOccurrences(of: "\n", with: " ")
    let source = (raw?.isEmpty == false ? raw! : slug)
    let limit = 40
    if source.count <= limit { return source }
    let idx = source.index(source.startIndex, offsetBy: limit)
    return String(source[..<idx]) + "…"
}

func formatSessionMenuTitle(_ session: WorkSession, slug: String, inRecent: Bool) -> String {
    let ind = sessionIndicator(phase: session.phase, inRecent: inRecent)
    let effort = session.effort ?? "—"
    let label = sessionLabel(session, slug: slug)
    let phaseUp = (session.phase ?? "").uppercased()
    let phaseStr = (phaseUp.isEmpty || phaseUp == "NATIVE") ? "" : phaseUp
    let prog = (session.progress != nil && session.progress != "0/0") ? session.progress! : ""
    let age = parseISO(session.updatedAt).map { formatAgeShort($0) } ?? ""

    var parts: [String] = [ind, effort, label]
    if !phaseStr.isEmpty { parts.append(phaseStr) }
    if !prog.isEmpty { parts.append(prog) }
    if !age.isEmpty { parts.append(age) }
    return parts.joined(separator: "  ")
}

// MARK: - Session Transcript Reader

enum TranscriptKind {
    case userText
    case assistantText
    case toolUse
    case thinking
    case other
}

struct TranscriptEvent {
    let kind: TranscriptKind
    let text: String       // For toolUse: tool name. For text: the text content.
    let toolDetail: String // For toolUse: short detail (cmd, file, etc.). Empty otherwise.
}

func transcriptPath(forUUID uuid: String) -> String {
    let home = ProcessInfo.processInfo.environment["HOME"] ?? NSString(string: "~").expandingTildeInPath
    return "\(home)/.claude/projects/-Users-janrenz/\(uuid).jsonl"
}

/// Reads the JSONL transcript and returns the last `limit` user/assistant/tool events.
func loadTranscript(uuid: String, limit: Int = 80) -> [TranscriptEvent] {
    let path = transcriptPath(forUUID: uuid)
    let fm = FileManager.default
    guard fm.fileExists(atPath: path),
          let data = fm.contents(atPath: path),
          let content = String(data: data, encoding: .utf8) else {
        return []
    }

    var events: [TranscriptEvent] = []
    let lines = content.split(separator: "\n", omittingEmptySubsequences: true)
    for line in lines {
        guard let lineData = line.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any] else {
            continue
        }
        let type = obj["type"] as? String ?? ""
        guard type == "user" || type == "assistant" else { continue }
        guard let message = obj["message"] as? [String: Any] else { continue }
        let role = (message["role"] as? String) ?? type

        // Content can be String or [Block]
        if let text = message["content"] as? String, !text.isEmpty {
            events.append(TranscriptEvent(
                kind: role == "user" ? .userText : .assistantText,
                text: text,
                toolDetail: ""
            ))
            continue
        }
        guard let blocks = message["content"] as? [[String: Any]] else { continue }
        for block in blocks {
            let btype = block["type"] as? String ?? ""
            switch btype {
            case "text":
                let t = (block["text"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty {
                    events.append(TranscriptEvent(
                        kind: role == "user" ? .userText : .assistantText,
                        text: t,
                        toolDetail: ""
                    ))
                }
            case "tool_use":
                let name = block["name"] as? String ?? "tool"
                let input = block["input"] as? [String: Any] ?? [:]
                var detail = ""
                if let cmd = input["command"] as? String {
                    detail = cmd.split(separator: "\n").first.map(String.init) ?? cmd
                } else if let path = input["file_path"] as? String {
                    detail = (path as NSString).lastPathComponent
                } else if let q = input["query"] as? String {
                    detail = q
                } else if let p = input["pattern"] as? String {
                    detail = p
                } else if let prompt = input["prompt"] as? String {
                    detail = String(prompt.prefix(60))
                }
                if detail.count > 80 {
                    let idx = detail.index(detail.startIndex, offsetBy: 80)
                    detail = String(detail[..<idx]) + "…"
                }
                events.append(TranscriptEvent(kind: .toolUse, text: name, toolDetail: detail))
            case "thinking":
                events.append(TranscriptEvent(kind: .thinking, text: "(thinking)", toolDetail: ""))
            default:
                continue
            }
        }
    }

    if events.count <= limit { return events }
    return Array(events.suffix(limit))
}

func cronToHuman(_ expr: String) -> String {
    let parts = expr.trimmingCharacters(in: .whitespaces).split(separator: " ").map(String.init)
    guard parts.count == 5 else { return expr }

    let (minute, hour, dom, month, dow) = (parts[0], parts[1], parts[2], parts[3], parts[4])

    // */N * * * * -> every Nmin
    if minute.hasPrefix("*/"), hour == "*", dom == "*", month == "*", dow == "*" {
        let n = String(minute.dropFirst(2))
        return "every \(n)min"
    }

    // N H * * * -> daily at H:MM
    if dom == "*", month == "*", dow == "*", !hour.contains("*"), !minute.contains("*"),
       let h = Int(hour), let m = Int(minute) {
        let ampm = h >= 12 ? "pm" : "am"
        let displayH = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        if m == 0 {
            return "daily at \(displayH)\(ampm)"
        }
        return "daily at \(displayH):\(String(format: "%02d", m))\(ampm)"
    }

    // 0 H,H,H * * * -> daily at Xam, Ypm, Zpm
    if dom == "*", month == "*", dow == "*", !hour.contains("*"), minute == "0" {
        let hours = hour.split(separator: ",").compactMap { Int($0) }
        if !hours.isEmpty {
            let formatted = hours.map { h -> String in
                let ampm = h >= 12 ? "pm" : "am"
                let displayH = h == 0 ? 12 : (h > 12 ? h - 12 : h)
                return "\(displayH)\(ampm)"
            }
            return "daily at \(formatted.joined(separator: ", "))"
        }
    }

    return expr
}

// MARK: - TOML Parser (minimal, handles PULSE.toml structure)

func parseHeartbeatJobs(from path: String) -> [HeartbeatJob] {
    let fm = FileManager.default
    guard let data = fm.contents(atPath: path),
          let content = String(data: data, encoding: .utf8) else { return [] }

    var jobs: [HeartbeatJob] = []
    var currentJob: [String: String]? = nil

    for line in content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)

        // Skip comments and empty lines
        if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }

        // New job section
        if trimmed == "[[job]]" {
            // Save previous job
            if let job = currentJob, let name = job["name"], let schedule = job["schedule"] {
                jobs.append(HeartbeatJob(
                    name: name,
                    schedule: schedule,
                    type: job["type"] ?? "script",
                    enabled: job["enabled"] != "false"
                ))
            }
            currentJob = [:]
            continue
        }

        // Parse key = value within a job
        guard currentJob != nil else { continue }
        let parts = trimmed.split(separator: "=", maxSplits: 1).map {
            $0.trimmingCharacters(in: .whitespaces)
        }
        guard parts.count == 2 else { continue }

        let key = parts[0]
        var value = parts[1]

        // Strip quotes
        if value.hasPrefix("\"") && value.hasSuffix("\"") && value.count >= 2 {
            value = String(value.dropFirst().dropLast())
        }

        currentJob?[key] = value
    }

    // Save last job
    if let job = currentJob, let name = job["name"], let schedule = job["schedule"] {
        jobs.append(HeartbeatJob(
            name: name,
            schedule: schedule,
            type: job["type"] ?? "script",
            enabled: job["enabled"] != "false"
        ))
    }

    return jobs
}

// MARK: - Status Determination

func determinePulseStatus(pulseDir: String) -> (PulseStatus, PulseState?) {
    let fm = FileManager.default
    let statePath = "\(pulseDir)/state/state.json"
    let pidPath = "\(pulseDir)/state/pulse.pid"

    // Check if state.json exists
    guard fm.fileExists(atPath: statePath) else {
        return (.stopped, nil)
    }

    // Check file modification time
    guard let attrs = try? fm.attributesOfItem(atPath: statePath),
          let modDate = attrs[.modificationDate] as? Date else {
        return (.stopped, nil)
    }

    let staleSeconds: TimeInterval = 120 // 2 minutes
    let fileAge = Date().timeIntervalSince(modDate)

    // Parse state JSON
    guard let data = fm.contents(atPath: statePath),
          let state = try? JSONDecoder().decode(PulseState.self, from: data) else {
        // File exists but corrupt
        return (.stopped, nil)
    }

    // Check PID file for process liveness
    var processAlive = false
    if let pidData = fm.contents(atPath: pidPath),
       let pidString = String(data: pidData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
       let pid = Int32(pidString) {
        processAlive = kill(pid, 0) == 0
    }

    // If process is not alive and state is stale, it's stopped
    if !processAlive && fileAge > staleSeconds {
        return (.stopped, state)
    }

    // Count failing jobs (consecutiveFailures >= 3)
    let failingJobs = state.jobs.values.filter { $0.consecutiveFailures >= 3 }
    if !failingJobs.isEmpty {
        return (.failing(count: failingJobs.count), state)
    }

    // Check staleness
    if fileAge > staleSeconds {
        return (.stale, state)
    }

    // Running normally
    let uptime = Date().timeIntervalSince1970 - state.startedAt / 1000
    return (.running(uptime: uptime), state)
}

// MARK: - App Delegate

class PulseMenuBarApp: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var pollTimer: Timer?
    private var currentStatus: PulseStatus = .stopped
    private var currentState: PulseState?

    private let pulseDir: String
    private let pollInterval: TimeInterval = 5.0

    private var paiDir: String { (pulseDir as NSString).deletingLastPathComponent }
    private var workJsonPath: String { "\(paiDir)/MEMORY/STATE/work.json" }
    private var activeSessions: [(slug: String, session: WorkSession)] = []
    private var recentSessions: [(slug: String, session: WorkSession)] = []
    private var activeSessionsCount: Int { activeSessions.count }

    private let sessionPopover = NSPopover()
    private let popoverController = SessionPopoverViewController()

    override init() {
        self.pulseDir = ProcessInfo.processInfo.environment["PAI_PULSE_DIR"]
            ?? NSString(string: "~/.claude/PAI/PULSE").expandingTildeInPath
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        sessionPopover.behavior = .transient
        sessionPopover.contentViewController = popoverController

        updateIcon()
        rebuildMenu()

        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }

        refreshStatus()
    }

    // MARK: - Status Refresh

    private func refreshStatus() {
        let (status, state) = determinePulseStatus(pulseDir: pulseDir)
        self.currentStatus = status
        self.currentState = state
        refreshWorkSessions()
        updateIcon()
        rebuildMenu()
    }

    private func refreshWorkSessions() {
        let all = parseWorkRegistry(from: workJsonPath)
        let now = Date()
        let fiveMin: TimeInterval = 300
        let oneDay: TimeInterval = 86_400

        var active: [(slug: String, session: WorkSession, date: Date)] = []
        var recent: [(slug: String, session: WorkSession, date: Date)] = []
        for (slug, session) in all {
            guard let updated = parseISO(session.updatedAt) else { continue }
            let age = now.timeIntervalSince(updated)
            if age < 0 { continue }
            let isComplete = (session.phase ?? "") == "complete"
            if !isComplete && age < fiveMin {
                active.append((slug, session, updated))
            } else if age < oneDay {
                recent.append((slug, session, updated))
            }
        }
        active.sort { $0.date > $1.date }
        recent.sort { $0.date > $1.date }
        self.activeSessions = Array(active.prefix(5)).map { (slug: $0.slug, session: $0.session) }
        self.recentSessions = Array(recent.prefix(3)).map { (slug: $0.slug, session: $0.session) }
    }

    // MARK: - Icon

    private func updateIcon() {
        guard let button = statusItem.button else { return }

        // Load PAI logo template image from app bundle Resources
        let iconPath = Bundle.main.path(forResource: "icon@2x", ofType: "png")
            ?? Bundle.main.path(forResource: "icon", ofType: "png")

        if let path = iconPath, let image = NSImage(contentsOfFile: path) {
            image.isTemplate = false  // Keep original PAI brand colors
            image.size = NSSize(width: 18, height: 18)
            button.image = image
        } else {
            // Fallback to SF Symbol if icon file not found
            let fallback = NSImage(systemSymbolName: "waveform.path.ecg", accessibilityDescription: "PAI Pulse")
            let config = NSImage.SymbolConfiguration(pointSize: 14, weight: .medium)
            button.image = fallback?.withSymbolConfiguration(config)
            button.contentTintColor = currentStatus.iconColor
        }

        // Active-sessions badge — number to the right of the icon
        let count = activeSessionsCount
        button.imagePosition = .imageLeft
        button.title = count > 0 ? " \(count)" : ""
    }

    // MARK: - Menu Construction

    private func rebuildMenu() {
        let menu = NSMenu()

        // Header
        let header = NSMenuItem(title: "PAI Pulse", action: nil, keyEquivalent: "")
        header.attributedTitle = NSAttributedString(
            string: "PAI Pulse",
            attributes: [.font: NSFont.boldSystemFont(ofSize: 13)]
        )
        menu.addItem(header)

        // Status line
        let statusLine = NSMenuItem(title: currentStatus.label, action: nil, keyEquivalent: "")
        statusLine.indentationLevel = 1
        menu.addItem(statusLine)

        // Active Sessions + Recent — surfaced from MEMORY/STATE/work.json
        let hasAnySessions = !activeSessions.isEmpty || !recentSessions.isEmpty
        if hasAnySessions {
            menu.addItem(NSMenuItem.separator())
        }

        if !activeSessions.isEmpty {
            let header = NSMenuItem(title: "Active Sessions", action: nil, keyEquivalent: "")
            header.attributedTitle = NSAttributedString(
                string: "Active Sessions",
                attributes: [
                    .font: NSFont.boldSystemFont(ofSize: 11),
                    .foregroundColor: NSColor.secondaryLabelColor,
                ]
            )
            menu.addItem(header)
            for (slug, session) in activeSessions {
                let title = formatSessionMenuTitle(session, slug: slug, inRecent: false)
                let item = NSMenuItem(title: title, action: #selector(openSessionPopover(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = slug
                item.indentationLevel = 1
                menu.addItem(item)
            }
        }

        if !recentSessions.isEmpty {
            // Collapsible category — Recent appears as a single item with a flyout submenu.
            let recentItem = NSMenuItem(title: "Recent (\(recentSessions.count))", action: nil, keyEquivalent: "")
            recentItem.attributedTitle = NSAttributedString(
                string: "Recent (\(recentSessions.count))",
                attributes: [
                    .font: NSFont.systemFont(ofSize: 13),
                    .foregroundColor: NSColor.secondaryLabelColor,
                ]
            )
            let recentSub = NSMenu()
            for (slug, session) in recentSessions {
                let title = formatSessionMenuTitle(session, slug: slug, inRecent: true)
                let item = NSMenuItem(title: title, action: #selector(openSessionPopover(_:)), keyEquivalent: "")
                item.target = self
                item.representedObject = slug
                recentSub.addItem(item)
            }
            recentItem.submenu = recentSub
            menu.addItem(recentItem)
        }

        menu.addItem(NSMenuItem.separator())

        // Jobs section
        let heartbeatPath = "\(pulseDir)/PULSE.toml"
        let heartbeatJobs = parseHeartbeatJobs(from: heartbeatPath)

        if !heartbeatJobs.isEmpty {
            let jobsHeader = NSMenuItem(title: "Jobs", action: nil, keyEquivalent: "")
            jobsHeader.attributedTitle = NSAttributedString(
                string: "Jobs",
                attributes: [.font: NSFont.boldSystemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]
            )
            menu.addItem(jobsHeader)

            for job in heartbeatJobs {
                let jobState = currentState?.jobs[job.name]

                // Build status indicator
                let indicator: String
                if !job.enabled {
                    indicator = "-- "  // disabled
                } else if let js = jobState {
                    if js.consecutiveFailures >= 3 {
                        indicator = "!! "  // failing
                    } else if js.lastResult == "error" {
                        indicator = "!  "  // single error
                    } else {
                        indicator = "ok "  // healthy
                    }
                } else {
                    indicator = "   "  // no state yet
                }

                // Build info string
                var info = cronToHuman(job.schedule)
                if let js = jobState {
                    info += "  |  \(formatAgo(js.lastRun))"
                    if js.consecutiveFailures > 0 {
                        info += "  |  \(js.consecutiveFailures)x fail"
                    }
                }

                let title = "\(indicator) \(job.name)  --  \(info)"
                let menuItem = NSMenuItem(title: title, action: nil, keyEquivalent: "")
                menuItem.indentationLevel = 1

                // Style based on state
                if !job.enabled {
                    menuItem.attributedTitle = NSAttributedString(
                        string: title,
                        attributes: [.foregroundColor: NSColor.tertiaryLabelColor]
                    )
                } else if let js = jobState, js.consecutiveFailures >= 3 {
                    menuItem.attributedTitle = NSAttributedString(
                        string: title,
                        attributes: [.foregroundColor: NSColor.systemRed]
                    )
                }

                menu.addItem(menuItem)
            }

            menu.addItem(NSMenuItem.separator())
        }

        // Control buttons
        switch currentStatus {
        case .running, .stale, .failing:
            let restartItem = NSMenuItem(title: "Restart Pulse", action: #selector(restartPulse), keyEquivalent: "r")
            restartItem.target = self
            menu.addItem(restartItem)

            let stopItem = NSMenuItem(title: "Stop Pulse", action: #selector(stopPulse), keyEquivalent: "")
            stopItem.target = self
            menu.addItem(stopItem)

        case .stopped:
            let startItem = NSMenuItem(title: "Start Pulse", action: #selector(startPulse), keyEquivalent: "s")
            startItem.target = self
            menu.addItem(startItem)
        }

        menu.addItem(NSMenuItem.separator())

        // Utility items
        let logsItem = NSMenuItem(title: "Open Logs...", action: #selector(openLogs), keyEquivalent: "l")
        logsItem.target = self
        menu.addItem(logsItem)

        let heartbeatItem = NSMenuItem(title: "Open PULSE.toml...", action: #selector(openHeartbeat), keyEquivalent: ",")
        heartbeatItem.target = self
        menu.addItem(heartbeatItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit Menu Bar", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    // MARK: - Actions

    @objc private func startPulse() {
        runManageScript(command: "start")
    }

    @objc private func stopPulse() {
        runManageScript(command: "stop")
    }

    @objc private func restartPulse() {
        runManageScript(command: "restart")
    }

    @objc private func openLogs() {
        let logPath = "\(pulseDir)/logs/pulse-stdout.log"
        let fm = FileManager.default
        if fm.fileExists(atPath: logPath) {
            NSWorkspace.shared.open(URL(fileURLWithPath: logPath))
        } else {
            // Open the logs directory if the specific file doesn't exist
            let logsDir = "\(pulseDir)/logs"
            if fm.fileExists(atPath: logsDir) {
                NSWorkspace.shared.open(URL(fileURLWithPath: logsDir))
            }
        }
    }

    @objc private func openHeartbeat() {
        let configPath = "\(pulseDir)/PULSE.toml"
        NSWorkspace.shared.open(URL(fileURLWithPath: configPath))
    }

    @objc private func openSessionPopover(_ sender: NSMenuItem) {
        guard let slug = sender.representedObject as? String else { return }
        // Look up the latest session data from our cached lists.
        let combined = activeSessions + recentSessions
        guard let entry = combined.first(where: { $0.slug == slug }) else { return }

        popoverController.configure(slug: slug, session: entry.session)

        guard let button = statusItem.button else { return }
        if sessionPopover.isShown {
            sessionPopover.performClose(nil)
        }
        sessionPopover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }

    // MARK: - Shell Out to manage.sh

    private func runManageScript(command: String) {
        let scriptPath = "\(pulseDir)/manage.sh"

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/bash")
            process.arguments = [scriptPath, command]
            process.environment = ProcessInfo.processInfo.environment

            do {
                try process.run()
                process.waitUntilExit()
            } catch {
                // Silently handle -- next refresh will show the real state
            }

            // Refresh after command completes
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self?.refreshStatus()
            }
        }
    }
}

// MARK: - Session Popover (read-only transcript viewer)

final class SessionPopoverViewController: NSViewController {
    private var slug: String = ""
    private var session: WorkSession?
    private var refreshTimer: Timer?

    private let headerLabel = NSTextField(labelWithString: "")
    private let subheaderLabel = NSTextField(labelWithString: "")
    private let scrollView = NSScrollView()
    private let textView = NSTextView()
    private let footerLabel = NSTextField(labelWithString: "Read-only · auto-refreshes every 2s")

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 560))

        // Header
        headerLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        headerLabel.textColor = .labelColor
        headerLabel.translatesAutoresizingMaskIntoConstraints = false
        headerLabel.lineBreakMode = .byTruncatingTail
        container.addSubview(headerLabel)

        subheaderLabel.font = NSFont.systemFont(ofSize: 11)
        subheaderLabel.textColor = .secondaryLabelColor
        subheaderLabel.translatesAutoresizingMaskIntoConstraints = false
        subheaderLabel.lineBreakMode = .byTruncatingTail
        container.addSubview(subheaderLabel)

        // Scroll + text view
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 6, height: 6)
        textView.font = NSFont.systemFont(ofSize: 12)
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(width: 460, height: CGFloat.greatestFiniteMagnitude)

        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.documentView = textView
        container.addSubview(scrollView)

        // Footer
        footerLabel.font = NSFont.systemFont(ofSize: 10)
        footerLabel.textColor = .tertiaryLabelColor
        footerLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(footerLabel)

        NSLayoutConstraint.activate([
            headerLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 12),
            headerLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 14),
            headerLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -14),

            subheaderLabel.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 2),
            subheaderLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 14),
            subheaderLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -14),

            scrollView.topAnchor.constraint(equalTo: subheaderLabel.bottomAnchor, constant: 10),
            scrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            scrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            scrollView.bottomAnchor.constraint(equalTo: footerLabel.topAnchor, constant: -6),

            footerLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 14),
            footerLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -14),
            footerLabel.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8),
        ])

        self.view = container
    }

    func configure(slug: String, session: WorkSession) {
        self.slug = slug
        self.session = session
        renderHeader()
        renderTranscript()
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        renderHeader()
        renderTranscript()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.renderHeader()
            self?.renderTranscript()
        }
    }

    override func viewWillDisappear() {
        super.viewWillDisappear()
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    private func renderHeader() {
        guard let s = session else { return }
        let ind = sessionIndicator(phase: s.phase, inRecent: false)
        let effort = s.effort ?? "—"
        let label = sessionLabel(s, slug: slug)
        headerLabel.stringValue = "\(ind)  \(effort)  \(label)"

        let phaseUp = (s.phase ?? "").uppercased()
        let phaseStr = (phaseUp.isEmpty || phaseUp == "NATIVE") ? "—" : phaseUp
        let prog = (s.progress != nil && s.progress != "0/0") ? " · \(s.progress!) ISCs" : ""
        let age = parseISO(s.updatedAt).map { " · updated \(formatAgeShort($0)) ago" } ?? ""
        subheaderLabel.stringValue = "\(phaseStr)\(prog)\(age)"
    }

    private func renderTranscript() {
        guard let s = session, let uuid = s.sessionUUID else {
            setBodyPlain("No session UUID — can't load transcript.")
            return
        }
        let events = loadTranscript(uuid: uuid, limit: 80)
        if events.isEmpty {
            setBodyPlain("No transcript yet — session may be brand new, or the file isn't readable.")
            return
        }

        let attr = NSMutableAttributedString()
        let bodyFont = NSFont.systemFont(ofSize: 12)
        let boldFont = NSFont.boldSystemFont(ofSize: 12)
        let monoFont = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

        for event in events {
            let prefix: String
            let prefixColor: NSColor
            let bodyColor: NSColor
            let useMono: Bool
            switch event.kind {
            case .userText:
                prefix = "You: "
                prefixColor = .systemBlue
                bodyColor = .labelColor
                useMono = false
            case .assistantText:
                prefix = "Timmy: "
                prefixColor = .systemPurple
                bodyColor = .labelColor
                useMono = false
            case .toolUse:
                prefix = "🔧 \(event.text): "
                prefixColor = .systemOrange
                bodyColor = .secondaryLabelColor
                useMono = true
            case .thinking:
                prefix = "(thinking) "
                prefixColor = .tertiaryLabelColor
                bodyColor = .tertiaryLabelColor
                useMono = false
            case .other:
                continue
            }

            let prefixAttr = NSAttributedString(string: prefix, attributes: [
                .font: boldFont,
                .foregroundColor: prefixColor,
            ])
            attr.append(prefixAttr)

            let bodyText: String
            switch event.kind {
            case .toolUse:
                bodyText = event.toolDetail.isEmpty ? "" : event.toolDetail
            default:
                bodyText = event.text
            }
            let bodyAttr = NSAttributedString(string: bodyText + "\n\n", attributes: [
                .font: useMono ? monoFont : bodyFont,
                .foregroundColor: bodyColor,
            ])
            attr.append(bodyAttr)
        }

        textView.textStorage?.setAttributedString(attr)
        textView.scrollToEndOfDocument(nil)
    }

    private func setBodyPlain(_ msg: String) {
        let attr = NSAttributedString(string: msg, attributes: [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: NSColor.secondaryLabelColor,
        ])
        textView.textStorage?.setAttributedString(attr)
    }
}

// MARK: - Entry Point

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = PulseMenuBarApp()
app.delegate = delegate
app.run()
