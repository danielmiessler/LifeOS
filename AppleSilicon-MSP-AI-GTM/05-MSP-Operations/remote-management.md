# Remote Management Operations

## The MSP Operational Advantage

The core of this business model's margin and scalability rests on a single principle: **the MSP manages everything, the customer manages nothing**. That promise is only deliverable at scale because of Apple's MDM ecosystem. Without Apple Business Manager, this would require an engineer on-site for every deployment and a second engineer for every update. With it, one skilled engineer can manage 50+ customer devices from a laptop.

This document is the operational manual for that capability.

---

## Section 1: The Zero-Touch MDM Model

### What Zero-Touch Means in Practice

Zero-touch deployment is not a marketing phrase — it is a precisely defined capability enabled by Apple's Device Enrollment Program (DEP), now integrated into Apple Business Manager (ABM). When it works correctly, a customer unboxes a device, plugs it into power and Ethernet, and the device configures itself to MSP specification within 15-20 minutes. The customer never installs software. They never configure settings. They never see a setup wizard beyond entering their Wi-Fi password (if not on Ethernet).

The sequence from purchase to operational AI workstation:

**Step 1: Hardware Assignment**
The MSP establishes an ABM organization and maintains an Apple Authorized Reseller relationship (or uses a third-party MDM-friendly Apple reseller). When hardware is ordered, the device serial number is automatically registered to the MSP's ABM organization via DEP. This happens at the reseller level — no action required by MSP or customer after the order is placed.

For customers who already own Apple hardware (edge case): devices manufactured after 2022 can be added to ABM via an Apple Configurator 2 workflow, which requires one physical connection but still automates all subsequent deployments.

**Step 2: ABM to MDM Assignment**
Inside ABM, the MSP assigns the device serial to the appropriate MDM server (Mosyle for Tier S/M, Jamf for Tier L/XL) and to the correct configuration profile for that customer's service tier and compliance requirements. This assignment is made before the device ships.

**Step 3: Device Ships to Customer Site**
Hardware ships directly from Apple (or the reseller) to the customer's physical address. The MSP never touches the box. The customer receives it with no pre-configuration instructions beyond "plug it in and connect to the internet."

**Step 4: First Boot Enrollment**
When the customer powers on the device and connects to the internet, macOS detects the ABM enrollment record during Setup Assistant. The device silently contacts the MDM server, downloads its configuration profile, and begins enrollment. The customer may see a brief "Remote Management" screen explaining the device is managed — this is expected and should be explained in pre-onboarding communication.

**Step 5: MDM Pushes Full Configuration**
Within minutes of enrollment, the MDM server pushes:
- **Security configuration profile**: FileVault encryption (with recovery key escrowed to MDM), password policy (complexity requirements, lock screen timeout), firewall enabled, Gatekeeper enforced, screen saver lock
- **Required applications**: LM Studio, AnythingLLM, Open WebUI, the MSP's monitoring agent — all deployed silently via MDM managed apps or deployment scripts
- **Network settings**: if the customer uses a corporate VPN or requires specific DNS configuration, those profiles are pushed automatically
- **Restriction profile**: prevents installation of unauthorized software categories; blocks remote access tools not explicitly approved; enforces macOS auto-update deferral policy (30-day deferral window controlled by MDM)

**Step 6: AI Stack Initialization**
Once base applications are installed, MDM triggers an initialization script that:
- Downloads the selected AI model to the local model store (via LM Studio CLI or direct file placement)
- Configures LM Studio to load the model at startup and expose the local API endpoint
- Configures AnythingLLM to connect to the LM Studio API, creates the customer's initial workspaces, sets document storage paths
- Configures Open WebUI to connect to both LM Studio and AnythingLLM backends, sets the customer's branding (if applicable), creates the admin user account

**The result**: the customer connects to `http://[device-local-IP]/` and their private AI is running. Total elapsed time from unboxing to operational: 20-45 minutes, depending on model download speed over the customer's internet connection.

### Operational Notes on Zero-Touch

- Model downloads are the most time-sensitive step. A 14B model is ~8-16GB; a 32B model is ~18-32GB. On a typical 500Mbps business connection, the 32B model downloads in 8-12 minutes. Brief the customer during onboarding that the first boot may take up to 30 minutes before the AI is ready.
- Always test the MDM enrollment workflow in the MSP lab with a spare device before each customer deployment. ABM enrollment records can occasionally require a few minutes to propagate — if enrollment fails, the fix is almost always waiting and retrying, not a configuration change.
- Keep one Mac Mini on the MSP's Ethernet bench as a "golden master" test device. Before any new configuration profile or software package reaches a customer, it must pass a full enrollment test on the bench device.

---

## Section 2: Remote Monitoring Stack

### What the MSP Monitors

Managed service contracts are only defensible if the MSP knows about problems before the customer does. The monitoring stack must provide visibility into four categories: device health, service health, compliance status, and model/software currency.

**Device Health Monitoring**
- CPU and GPU utilization (Apple Silicon GPU is the inference engine — sustained 100% GPU is expected during inference, but 100% CPU at idle suggests a runaway process)
- Memory pressure: unified memory is shared between CPU and GPU; high memory compression ratios indicate the system is being pushed beyond comfortable limits for the loaded model
- Disk space: model files are large; a 32B model plus OS plus logs can consume 80GB+ on a 256GB device — monitor free space and alert at <20% free
- Thermal state: Apple Silicon throttles under sustained heat; macOS reports thermal state via the `pmset` command and Unified Log — MDM scripts can surface this to the monitoring dashboard
- Battery health (Mac Mini and Studio are AC-powered, but Mac Pro on UPS may report battery events): not a primary concern but included for completeness

**Service Health Monitoring**
The AI stack runs as local services. The MDM monitoring agent runs a health check script every 5 minutes:

```bash
# LM Studio API health check
curl -sf http://localhost:1234/v1/models > /dev/null && echo "OK" || echo "FAIL"

# AnythingLLM health check
curl -sf http://localhost:3001/api/ping > /dev/null && echo "OK" || echo "FAIL"

# Open WebUI health check
curl -sf http://localhost:8080 > /dev/null && echo "OK" || echo "FAIL"
```

Results are reported to the MDM telemetry endpoint. If any check returns FAIL for two consecutive intervals (10 minutes), an automated alert fires and the MSP on-call engineer is notified.

**Compliance Status Monitoring**
Mosyle and Jamf both provide compliance scoring dashboards. The MSP defines a compliance policy that includes:
- FileVault: enabled and recovery key escrowed (required — customer data is encrypted at rest)
- OS version: within 30 days of current release (MDM-enforced deferral window)
- Gatekeeper: enabled, blocking unnotarized apps
- Screensaver lock: triggers within 10 minutes of inactivity
- Software restriction: no unauthorized remote access tools, no known-malicious applications
- Approved application inventory: only MSP-approved applications present in /Applications

A device that fails any compliance check is flagged in the dashboard and triggers a weekly compliance report to the MSP operations team.

**Model and Software Currency**
The monitoring agent checks:
- Model files present at expected paths with expected file hashes (ensures no corruption or accidental deletion)
- LM Studio version matches MSP-approved version
- AnythingLLM version matches MSP-approved version
- Open WebUI version matches MSP-approved version

Currency checks run daily. Results appear in the MSP management console. Stale software versions trigger a remediation workflow.

### Monitoring Tools

**Mosyle Business (Primary MDM — Tier S/M)**
Mosyle Business at ~$4/device/month provides the complete MDM lifecycle for smaller customers. Its built-in monitoring dashboard shows:
- Device inventory with online/offline status
- Compliance scores per device and per policy category
- OS version distribution across the fleet
- Application inventory (verifies approved apps are present, flags unauthorized installs)
- Scripting engine: MSP uploads custom health check scripts; results feed into the monitoring dashboard

Mosyle's alert system sends email notifications for compliance failures and device offline events. For a Tier S/M customer base, this is sufficient for business-hours monitoring.

**Jamf Pro (Enterprise MDM — Tier L/XL)**
Jamf Pro provides additional capability for larger customers:
- Smart Groups: automatically segment devices by compliance state, OS version, or application inventory — enables targeted remediation policies
- Jamf Protect integration: extended endpoint telemetry, macOS Unified Log queries at scale, threat detection
- Compliance reporting templates aligned to NIST 800-171 (required for CMMC) — exportable as PDF for customer audits
- Policy scope control: push specific scripts or profiles to specific devices or groups without affecting the full fleet

For CMMC-obligated customers, Jamf Pro's audit trail and policy documentation capabilities are worth the higher per-device cost.

**Optional: Grafana Cloud (Service-Level Dashboard)**
For customers who want a real-time service uptime dashboard (useful for Gold tier), the MSP can deploy a lightweight Grafana agent on the customer's device that ships inference API response times, query counts, and uptime metrics to Grafana Cloud (free tier supports up to 50GB metrics/month). This creates a customer-visible dashboard showing:
- Queries per hour / day
- Median and P95 inference response time
- Service uptime over 30/90 days
- Model loaded and version

This dashboard is a QBR deliverable and a retention tool — customers who can see their AI usage data are more engaged with the service.

**Datadog (Optional for Gold Tier)**
For enterprise customers with existing Datadog deployments, the MSP can integrate the AI stack metrics into the customer's existing Datadog organization. This requires more setup but is a strong differentiator for technically sophisticated Gold accounts.

---

## Section 3: Model and Software Updates

### Why Model Updates Are the Core Differentiator

The open-source AI model landscape moves fast. Llama-4, Qwen-3, Mistral, Gemma — a major new model release happens every 4-8 weeks. Each new generation delivers meaningful quality improvements: better reasoning, better instruction following, better multilingual capability. A customer who deployed Qwen2.5-14B in Q1 will be running a materially inferior model by Q3 if nobody updates it.

For a law firm or medical practice, this is not a software version number — it is the quality of the AI advice their staff depends on daily. The MSP's job is to ensure that quality improves automatically, without the customer ever having to think about it.

This is a capability no in-house IT team can deliver at the same cost — they do not have the infrastructure to test models, the expertise to evaluate quality, or the operational workflow to deploy updates to multiple practices. The MSP does.

### AI Model Update Workflow

**Stage 1: Model Evaluation (MSP Lab)**
When a significant new model is released:
1. MSP pulls the new model to the lab Mac (same hardware tier as customer devices)
2. MSP runs a standardized evaluation suite against the model: 20-30 prompts covering the customer's primary use cases (legal document Q&A, medical note summarization, contract review, etc.)
3. MSP compares outputs against the current production model on quality dimensions: accuracy, coherence, instruction following, refusal behavior on out-of-scope requests
4. If the new model passes quality bar (meaningfully better or equal on all dimensions, no regressions), it is approved for customer deployment
5. If the new model fails any dimension (e.g., worse instruction following, unexpected refusal patterns), it is held and re-evaluated at next major release

Evaluation takes 2-4 hours per model. For Bronze tier (quarterly updates), this represents approximately 8-16 hours/year of MSP evaluation time per model architecture. For Silver tier (monthly evaluation), budget 20-30 hours/year.

**Stage 2: Package and Stage**
1. MSP creates an MDM deployment script that:
   - Downloads the new model GGUF file to a staging path (not the active model path)
   - Verifies file hash against the expected SHA256 (integrity check)
   - Gracefully stops LM Studio's API service
   - Moves new model to active path, renames old model as backup
   - Restarts LM Studio pointing to new model
   - Runs health check — if LM Studio API returns OK, marks update complete; if health check fails, rolls back to backup model and alerts MSP
2. Script is tested on lab device — full run-through including rollback path
3. Script is staged in Mosyle/Jamf as a scheduled policy, not yet assigned to production devices

**Stage 3: Maintenance Window Deployment**
1. MSP assigns the deployment script to the customer's device group in Mosyle/Jamf
2. Policy is scheduled for the customer's maintenance window (typically 2:00-4:00 AM local time, configured per customer)
3. MDM pushes the script; device runs the update autonomously
4. Model download time: 10-30 minutes depending on model size and connection speed
5. MSP verifies via health check telemetry that service came back up successfully

**Stage 4: Notification**
After successful deployment, MSP sends the customer a brief email:

> "Your AI has been updated. As of [date], your system is now running [Model Name] — a new generation model that delivers improved [reasoning / document understanding / multilingual support]. No action is needed on your part. If you notice any changes in response quality (positive or negative), please let us know at [support email]."

This email serves two purposes: it demonstrates ongoing value delivery (the customer is reminded monthly/quarterly that the MSP is actively managing their AI), and it establishes a feedback loop for quality issues.

### OS and Application Update Workflow

**macOS Updates**
macOS updates are deferred 30 days by MDM policy. This 30-day window gives Apple time to issue point releases addressing post-launch bugs before the update reaches production devices. After the 30-day hold:
1. MDM pushes the OS update during the customer's maintenance window
2. Device downloads and installs the update, reboots
3. MSP verifies device came back online post-reboot via MDM telemetry
4. MSP verifies AI stack services restarted correctly via health checks

Major macOS version upgrades (e.g., macOS 14 → 15) are held for 60 days and require lab validation on a test device before production deployment.

**LM Studio, AnythingLLM, Open WebUI**
Application updates follow a similar staged workflow:
1. MSP monitors each application's GitHub releases and release notes
2. New release is deployed to lab device and tested against standard use cases
3. If no regressions, MSP packages the update as an MDM script (download, stop service, replace binary, restart, health check)
4. Update is scheduled for the next maintenance window across customer fleet
5. Health check verification runs post-update

Frequency: MSP targets application updates on a monthly cadence, aligned with the Silver-tier model evaluation cycle.

---

## Section 4: Remote Support Workflow

### The 95% Remote Resolution Principle

An MSP that sends a technician to the customer site for routine support is not scalable. The target for this operation is 95%+ of all support interactions resolved without physical presence. Apple's MDM stack — combined with built-in macOS remote access capabilities — makes this achievable.

The three-tier support model:

**Tier 1: User Experience Issues (Open WebUI / AnythingLLM)**
These are the most common support tickets: "The AI gave me a wrong answer," "I can't find where to upload documents," "How do I change my prompt," "The response is too long."

Resolution path:
- Email/ticketing system first — many issues are how-to questions answerable asynchronously
- If the customer needs to see it demonstrated: MSP schedules a 15-30 minute video call (Zoom/Teams)
- If the customer's screen needs to be seen: MSP requests a screen share via Apple Screen Sharing (built into macOS, initiated by customer) or TeamViewer (if pre-installed by MDM)
- Customer approves every remote screen share session explicitly — they initiate or accept the session, maintaining trust

No Tier 1 issue should require MDM access. These are UX questions, not infrastructure problems.

**Tier 2: Service Issues (AI Stack Down or Degraded)**
These require MSP access to the device itself — not just the user's screen.

Resolution path:
1. MSP detects service down via monitoring alert (before customer usually notices)
2. MSP accesses device via MDM remote management console (Mosyle Remote or Jamf Remote) — this is a full remote session to the device, not dependent on a user being present
3. MSP reviews service logs:
   ```bash
   # Check LM Studio logs
   log show --predicate 'process == "LM Studio"' --last 1h
   
   # Check system-level service errors
   log show --predicate 'category == "default" AND subsystem CONTAINS "lmstudio"' --last 2h
   ```
4. Common Tier 2 resolutions:
   - Service crashed and did not restart: `launchctl kickstart -k system/com.lmstudio.server`
   - Model file corrupted: re-download model via MDM script
   - Disk space exhausted: clear old model backups and log files via MDM script
   - macOS update reboot did not bring services back up: restart services via MDM script
5. MSP verifies health checks pass before closing the ticket

Target resolution time: 2 hours for Silver tier, 1 hour for Gold tier, 8 business hours for Bronze.

**Tier 3: Configuration and Model Issues**
Configuration changes — new workspaces in AnythingLLM, changed authentication in Open WebUI, network configuration updates — require MDM profile pushes or script execution.

Resolution path:
1. MSP assesses required configuration change
2. If it is a profile change (e.g., updated security policy, new network configuration): MSP updates profile in MDM and pushes to device
3. If it is an application configuration change (e.g., new AnythingLLM workspace, updated LM Studio model settings): MSP accesses device via MDM remote session, makes the change directly, or deploys a configuration script
4. MSP documents the change in the customer's configuration record (maintained in PSA tool — ConnectWise, HaloPSA, or similar)

**Escalation: On-Site Visits**
On-site visits are reserved for:
- Hardware failure (Mac requires physical repair or replacement)
- Network configuration that the customer's IT contact cannot implement remotely (e.g., VLAN setup requiring physical switch configuration)
- Initial deployment where the customer is not technically comfortable with any remote interaction

On-site SLA: within 5 business days for Silver tier, within 2 business days for Gold tier (within 50-mile radius of MSP base; remote-equivalent support for customers outside range).

**Practical note**: In the first year of operation, expect 80% of support to be Tier 1 user questions. As customers become comfortable with the AI tools, this drops significantly. Model the support load at 2-4 tickets/customer/month in months 1-3, declining to 0.5-1 ticket/customer/month by month 6.

---

## Section 5: Security Operations

### MSP Security Responsibilities

The MSP is not the customer's CISO. The MSP is responsible for the security posture of the AI infrastructure it manages — the Apple hardware, the MDM configuration, the AI software stack, and the data flows within that stack. The customer retains responsibility for their broader network security, employee training, and regulatory compliance program.

That said, the MSP's security operations create significant value by catching configuration drift, flagging anomalies, and supporting the customer's compliance documentation obligations.

### Security Operations Calendar

**Weekly — MDM Compliance Review**
- Pull compliance report from Mosyle/Jamf for all active customer devices
- Review compliance scores — any device below threshold triggers investigation
- Common compliance failures and resolutions:
  - FileVault disabled: user disabled it in System Preferences (rare; MDM should re-enforce) — re-push FileVault enforcement profile
  - OS version out of date: device was offline during maintenance window — reschedule push
  - Unauthorized application detected: investigate, determine if business-justified or policy violation, notify customer
- Document findings in MSP operations log (even "all clear" — creates audit trail)

**Monthly — Service Usage Anomaly Review**
Open WebUI and AnythingLLM both maintain query logs. MSP reviews (with appropriate notice to customer in the service agreement):
- Unusual query volume spikes (could indicate unauthorized external access if device is internet-facing)
- Off-hours access patterns (expected: occasional; concerning: high-volume queries at 3 AM)
- Query content patterns: MSP does not read individual queries (customer privacy), but does review aggregate statistics (query count per user, query time distribution)
- Authentication events: failed logins, new user account creation not authorized by MSP

**Quarterly — macOS Unified Log Security Review**
For HIPAA and CMMC customers, the MSP runs a structured log analysis:
```bash
# Failed authentication attempts
log show --predicate 'eventMessage CONTAINS "authentication failed"' --last 90d

# Privilege escalation events  
log show --predicate 'eventMessage CONTAINS "sudo"' --last 90d

# Remote access events
log show --predicate 'process == "screensharingd"' --last 90d
```
Findings are summarized in a quarterly security memo to the customer. For CMMC customers, this feeds into their Plan of Action and Milestones (POA&M) process.

**Annual — Compliance Documentation Support**

*HIPAA customers*: MSP assists with the annual Risk Analysis update. The MSP contributes:
- Device security posture report (FileVault status, OS version, application inventory)
- Incident log (any security events from MDM telemetry over the past year)
- Updated data flow description for the AI system (what data enters the AI, where it is stored, who has access)

*CMMC Level 1/2 customers*: MSP assists with the annual self-assessment or C3PAO readiness review:
- Evidence package: MDM compliance reports, configuration profiles, software inventory
- Access control documentation: user accounts in Open WebUI, authentication configuration
- Incident response documentation: any Tier 2/3 support events and their resolution
- Configuration management documentation: model update log, software update log

The MSP should maintain a compliance documentation template for each regulatory framework as a managed deliverable. Customers who receive this assistance are dramatically less likely to churn — switching MSPs means re-documenting everything.

### Data Handling Principles (Customer Communication)

The MSP should make its data access practices explicit in the service agreement and reinforce them annually:
- MSP MDM access is limited to device management functions; MSP does not have access to customer documents uploaded to AnythingLLM
- MSP remote sessions (when required for support) are session-specific and customer-approved; MSP does not maintain persistent background access to the device console
- Query logs, if reviewed for anomaly detection, are reviewed at the aggregate/statistical level; individual query content is not accessed or stored by the MSP
- Model files deployed by the MSP are open-source community models (Llama, Qwen, Mistral) with publicly available model cards; no proprietary data leaves the customer site

This transparency is not optional for regulated customers — it is a prerequisite for the customer's own compliance program. Build it into the onboarding process and the annual compliance review.
