import Cocoa
import ServiceManagement

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var statusMenuItem: NSMenuItem!
    private var startStopMenuItem: NSMenuItem!
    private var timer: Timer?
    private var isRunning = false

    private let manageScriptPath = NSHomeDirectory() + "/.claude/Observability/manage.sh"
    private let serverPort = 4000
    private let clientPort = 5172

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create the status bar item
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "eye.circle", accessibilityDescription: "Observability")
            button.image?.isTemplate = true
        }

        setupMenu()

        // Start checking status periodically
        checkStatus()
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.checkStatus()
        }

        // Auto-start on launch
        autoStart()
    }

    func applicationWillTerminate(_ notification: Notification) {
        timer?.invalidate()
    }

    private func setupMenu() {
        let menu = NSMenu()

        // Status indicator
        statusMenuItem = NSMenuItem(title: "Status: Checking...", action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)

        menu.addItem(NSMenuItem.separator())

        // Start/Stop toggle
        startStopMenuItem = NSMenuItem(title: "Start", action: #selector(toggleService), keyEquivalent: "s")
        startStopMenuItem.target = self
        menu.addItem(startStopMenuItem)

        // Restart
        let restartItem = NSMenuItem(title: "Restart", action: #selector(restartService), keyEquivalent: "r")
        restartItem.target = self
        menu.addItem(restartItem)

        menu.addItem(NSMenuItem.separator())

        // Open Dashboard
        let openItem = NSMenuItem(title: "Open Dashboard", action: #selector(openDashboard), keyEquivalent: "o")
        openItem.target = self
        menu.addItem(openItem)

        menu.addItem(NSMenuItem.separator())

        // Launch at Login
        let launchAtLoginItem = NSMenuItem(title: "Launch at Login", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        launchAtLoginItem.target = self
        launchAtLoginItem.state = isLaunchAtLoginEnabled() ? .on : .off
        menu.addItem(launchAtLoginItem)

        menu.addItem(NSMenuItem.separator())

        // Quit
        let quitItem = NSMenuItem(title: "Quit Observability", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    private func autoStart() {
        // Run autostart on a slight delay to ensure app is fully initialized
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self = self else { return }
            if !self.isServerRunning() {
                self.startService()
            }
        }
    }

    private func checkStatus() {
        let running = isServerRunning()
        isRunning = running

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if running {
                self.statusMenuItem.title = "Status: Running"
                self.startStopMenuItem.title = "Stop"
                if let button = self.statusItem.button {
                    button.image = NSImage(systemSymbolName: "eye.circle.fill", accessibilityDescription: "Observability Running")
                    button.image?.isTemplate = true
                }
            } else {
                self.statusMenuItem.title = "Status: Stopped"
                self.startStopMenuItem.title = "Start"
                if let button = self.statusItem.button {
                    button.image = NSImage(systemSymbolName: "eye.circle", accessibilityDescription: "Observability Stopped")
                    button.image?.isTemplate = true
                }
            }
        }
    }

    private func isServerRunning() -> Bool {
        let task = Process()
        task.launchPath = "/usr/sbin/lsof"
        task.arguments = ["-i", ":\(serverPort)", "-sTCP:LISTEN"]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe

        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus == 0
        } catch {
            return false
        }
    }

    @objc private func toggleService() {
        if isRunning {
            stopService()
        } else {
            startService()
        }
    }

    private func startService() {
        // Run in background thread but wait for completion
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let homePath = NSHomeDirectory()
            let scriptPath = self.manageScriptPath
            let workDir = "\(homePath)/.claude/Observability"

            // Set up environment with PATH including bun
            var env = ProcessInfo.processInfo.environment
            let additionalPaths = [
                "\(homePath)/.bun/bin",
                "\(homePath)/.local/bin",
                "/opt/homebrew/bin",
                "/usr/local/bin"
            ]
            env["PATH"] = additionalPaths.joined(separator: ":") + ":/usr/bin:/bin"
            env["HOME"] = homePath

            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/bin/bash")
            task.arguments = [scriptPath, "start-detached"]
            task.currentDirectoryURL = URL(fileURLWithPath: workDir)
            task.environment = env
            task.standardOutput = FileHandle.nullDevice
            task.standardError = FileHandle.nullDevice

            do {
                try task.run()
                task.waitUntilExit()
            } catch {
                // Silently fail
            }

            // Update status on main thread
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.checkStatus()
            }
        }
    }

    private func stopService() {
        runManageScript(with: "stop", waitForCompletion: true)

        // Delay status check to allow service to stop
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.checkStatus()
        }
    }

    @objc private func restartService() {
        runManageScript(with: "stop", waitForCompletion: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.startService()

            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self?.checkStatus()
            }
        }
    }

    private func runManageScript(with command: String, waitForCompletion: Bool = false) {
        let homePath = NSHomeDirectory()
        let scriptPath = self.manageScriptPath
        let workDir = "\(homePath)/.claude/Observability"

        // Set up environment with PATH including bun
        var env = ProcessInfo.processInfo.environment
        let additionalPaths = [
            "\(homePath)/.bun/bin",
            "\(homePath)/.local/bin",
            "/opt/homebrew/bin",
            "/usr/local/bin"
        ]
        env["PATH"] = additionalPaths.joined(separator: ":") + ":/usr/bin:/bin"
        env["HOME"] = homePath

        DispatchQueue.global(qos: .userInitiated).async {
            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/bin/bash")
            task.arguments = [scriptPath, command]
            task.currentDirectoryURL = URL(fileURLWithPath: workDir)
            task.environment = env

            task.standardOutput = FileHandle.nullDevice
            task.standardError = FileHandle.nullDevice

            do {
                try task.run()
                if waitForCompletion {
                    task.waitUntilExit()
                }
            } catch {
                // Ignore errors
            }
        }
    }

    @objc private func openDashboard() {
        if let url = URL(string: "http://localhost:\(clientPort)") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc private func toggleLaunchAtLogin(_ sender: NSMenuItem) {
        let newState = sender.state == .off
        setLaunchAtLogin(enabled: newState)
        sender.state = newState ? .on : .off
    }

    private func isLaunchAtLoginEnabled() -> Bool {
        // Check if LaunchAgent plist exists
        let launchAgentPath = NSHomeDirectory() + "/Library/LaunchAgents/com.kai.observability.plist"
        return FileManager.default.fileExists(atPath: launchAgentPath)
    }

    private func setLaunchAtLogin(enabled: Bool) {
        let launchAgentPath = NSHomeDirectory() + "/Library/LaunchAgents/com.kai.observability.plist"
        let appPath = Bundle.main.bundlePath

        if enabled {
            // Create LaunchAgent plist
            let plistContent = """
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0">
            <dict>
                <key>Label</key>
                <string>com.kai.observability</string>
                <key>ProgramArguments</key>
                <array>
                    <string>/usr/bin/open</string>
                    <string>-a</string>
                    <string>\(appPath)</string>
                </array>
                <key>RunAtLoad</key>
                <true/>
                <key>KeepAlive</key>
                <false/>
            </dict>
            </plist>
            """

            do {
                // Ensure LaunchAgents directory exists
                let launchAgentsDir = NSHomeDirectory() + "/Library/LaunchAgents"
                try FileManager.default.createDirectory(atPath: launchAgentsDir, withIntermediateDirectories: true)

                try plistContent.write(toFile: launchAgentPath, atomically: true, encoding: .utf8)

                // Load the launch agent
                let task = Process()
                task.launchPath = "/bin/launchctl"
                task.arguments = ["load", launchAgentPath]
                try task.run()
                task.waitUntilExit()
            } catch {
                // Ignore errors
            }
        } else {
            // Remove LaunchAgent plist
            do {
                // Unload first
                let task = Process()
                task.launchPath = "/bin/launchctl"
                task.arguments = ["unload", launchAgentPath]
                try task.run()
                task.waitUntilExit()

                try FileManager.default.removeItem(atPath: launchAgentPath)
            } catch {
                // Ignore errors
            }
        }
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(self)
    }
}

// Main entry point - properly initialize the app with delegate
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
