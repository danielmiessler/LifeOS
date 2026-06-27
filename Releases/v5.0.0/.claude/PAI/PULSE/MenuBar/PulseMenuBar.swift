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

    override init() {
        self.pulseDir = ProcessInfo.processInfo.environment["PAI_PULSE_DIR"]
            ?? NSString(string: "~/.pai/PULSE").expandingTildeInPath
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

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
        updateIcon()
        rebuildMenu()
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

// MARK: - Entry Point

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = PulseMenuBarApp()
app.delegate = delegate
app.run()
