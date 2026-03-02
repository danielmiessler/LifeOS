# Visualization & Threat Intelligence OSINT Tools

**Installation Date:** 2025-11-11
**Purpose:** Visual relationship mapping and threat intelligence platforms for security research
**Skill:** webassessment (Penetration Testing & Security Research)

---

## 🎨 Gephi - Social Network Visualization

### Installation Status: ✅ INSTALLED & READY

**Location:** `/Applications/Gephi.app`
**Version:** 0.10.1
**Installation Method:** Homebrew (`brew install gephi`)
**Java Requirement:** OpenJDK 25 (already installed)

### Launch Command
```bash
# GUI Launch
open -a Gephi

# Or from Applications folder
open /Applications/Gephi.app
```

### What Gephi Does

Gephi is an open-source platform for visualizing and manipulating large graphs and network data. It's the leading visualization and exploration software for all kinds of graphs and networks.

**Core Capabilities:**
- Social network analysis and visualization
- Relationship mapping between entities
- Network topology discovery
- Community detection algorithms
- Graph layout algorithms (Force Atlas, Fruchterman-Reingold, etc.)
- Real-time visualization of large datasets (millions of nodes/edges)

### Use Cases for Security Research

1. **Infrastructure Mapping**
   - Visualize domain-to-IP relationships
   - Map organizational network infrastructure
   - Identify hidden connections between assets

2. **Social Engineering Reconnaissance**
   - Map social media relationships
   - Identify key influencers in organizations
   - Discover communication patterns

3. **Threat Actor Attribution**
   - Visualize relationships between threat actors
   - Map infrastructure used by APT groups
   - Identify shared TTPs and tools

4. **Malware Analysis**
   - Visualize code call graphs
   - Map C2 infrastructure networks
   - Identify malware family relationships

5. **Data Leak Analysis**
   - Visualize email dump relationships
   - Map credential reuse patterns
   - Identify connected accounts

### Typical Workflow

1. **Collect Data** - Use OSINT tools (Maltego, theHarvester, Shodan) to gather relationship data
2. **Export to CSV/GEXF** - Format data as nodes (entities) and edges (relationships)
3. **Import to Gephi** - Load data into Gephi workspace
4. **Apply Layout** - Use Force Atlas 2 or other algorithms to spatially organize nodes
5. **Run Algorithms** - Apply centrality, clustering, and community detection
6. **Visualize** - Color-code nodes, adjust sizes based on importance
7. **Export** - Save as SVG, PDF, or PNG for reports

### Data Format

**Nodes CSV:**
```csv
Id,Label,Type
1,evil.com,domain
2,192.168.1.1,ip
3,attacker@evil.com,email
```

**Edges CSV:**
```csv
Source,Target,Type,Weight
1,2,resolves_to,1
3,1,uses,1
```

### When to Use Gephi

**Use Gephi when you need to:**
- Understand complex relationships between many entities
- Identify central/critical nodes in a network
- Detect communities or clusters in data
- Present visual evidence of connections
- Explore large datasets interactively

**Don't use Gephi when:**
- You need automated threat intelligence (use OpenCTI/MISP)
- You need real-time threat feeds (use OpenCTI/MISP)
- You need enterprise-grade threat management (use OpenCTI/MISP)
- Your data is simple enough for basic visualization tools

---

## 🕵️ OpenCTI - Open Cyber Threat Intelligence Platform

### Installation Status: ❌ NOT INSTALLED (Documented for Future Use)

**Repository:** https://github.com/OpenCTI-Platform/opencti
**Documentation:** https://docs.opencti.io/
**License:** Apache 2.0 (Free & Open Source)

### What OpenCTI Does

OpenCTI is a comprehensive open-source platform designed to manage cyber threat intelligence knowledge and observables. It's built on STIX 2.1 standards and provides a unified framework for threat intelligence operations.

**Core Capabilities:**
- Threat intelligence data management (structured using STIX 2.1)
- Integration with MITRE ATT&CK framework
- Automated threat intelligence ingestion from 100+ sources
- Knowledge graph visualization
- Indicator management (IoCs, TTPs, threat actors)
- Collaborative analysis and reporting
- Export to STIX, CSV, PDF formats
- API for automation and integration

### Architecture

OpenCTI runs as a multi-container Docker application:
- **Frontend:** Web UI (React)
- **Backend:** GraphQL API (Python)
- **Workers:** Background processing and connectors
- **Database:** PostgreSQL
- **Search:** ElasticSearch
- **Cache:** Redis
- **Message Queue:** RabbitMQ

### System Requirements

**Minimum (Development):**
- 4 CPU cores
- 8 GB RAM
- 50 GB disk space
- Docker & Docker Compose

**Recommended (Production):**
- 8+ CPU cores
- 16+ GB RAM
- 200+ GB disk space (for long-term data retention)
- Docker Swarm or Kubernetes

### Installation Requirements

**Prerequisites:**
```bash
# Install Docker Desktop (if not already installed)
brew install --cask docker

# Or use Colima (lightweight Docker alternative)
brew install colima docker docker-compose
colima start --cpu 4 --memory 8
```

**Installation Steps (When Needed):**
```bash
# 1. Clone repository
git clone https://github.com/OpenCTI-Platform/opencti.git
cd opencti/docker

# 2. Configure environment
cp .env.sample .env
# Edit .env with secure passwords and API keys

# 3. Launch platform
docker-compose up -d

# 4. Access UI
open http://localhost:8080
# Default credentials: admin@opencti.io / admin (change immediately)
```

**Estimated Setup Time:** 30-60 minutes (download, configure, launch, initial setup)

### Use Cases for Security Research

1. **Threat Intelligence Aggregation**
   - Automatically ingest threat feeds from OSINT sources
   - Centralize IoCs from multiple vendors
   - Build a unified threat intelligence database

2. **MITRE ATT&CK Mapping**
   - Map observed TTPs to ATT&CK framework
   - Track threat actor techniques
   - Generate ATT&CK Navigator layers

3. **Threat Actor Tracking**
   - Maintain profiles of APT groups
   - Track campaigns and operations
   - Link infrastructure to threat actors

4. **Incident Investigation**
   - Pivot from IoCs to related intelligence
   - Discover related malware, infrastructure, TTPs
   - Build timeline of threat actor activity

5. **Threat Intelligence Reporting**
   - Generate professional threat intelligence reports
   - Export data in STIX 2.1 format
   - Share intelligence with partners

### When to Use OpenCTI

**Use OpenCTI when you need:**
- Enterprise-grade threat intelligence management
- Automated ingestion of threat feeds from many sources
- STIX 2.1 compliant threat intelligence database
- MITRE ATT&CK integration and tracking
- Collaborative threat intelligence platform (team environment)
- Long-term storage and historical analysis of threats
- Formal threat intelligence program

**Don't use OpenCTI when:**
- You need simple visualization (use Gephi)
- You don't have Docker infrastructure available
- You need lightweight/quick analysis (use Maltego + Gephi)
- You're doing one-off reconnaissance (use individual OSINT tools)
- You don't have 8+ GB RAM to dedicate

### Integration with OSINT Tools

OpenCTI has 100+ connectors for automated threat intelligence ingestion:
- AlienVault OTX
- MISP instances
- Shodan
- VirusTotal
- MITRE ATT&CK
- CVE databases
- Abuse.ch feeds (URLhaus, ThreatFox, etc.)
- Many more...

---

## 🔗 MISP - Malware Information Sharing Platform

### Installation Status: ❌ NOT INSTALLED (Documented for Future Use)

**Repository:** https://github.com/MISP/MISP
**Documentation:** https://www.misp-project.org/documentation/
**License:** AGPL v3 (Free & Open Source)

### What MISP Does

MISP (Malware Information Sharing Platform) is an open-source threat intelligence platform designed for sharing, storing, and correlating Indicators of Compromise (IoCs) of targeted attacks, threat intelligence, financial fraud, and more.

**Core Capabilities:**
- IoC storage and correlation
- Event-based threat intelligence sharing
- Automated threat intelligence ingestion
- Taxonomies and tagging (threat classification)
- Correlation engine (automatic relationship discovery)
- Collaborative analysis (multi-organization sharing)
- Export to multiple formats (STIX, JSON, CSV, etc.)
- REST API for automation
- Threat feed generation

### Architecture

MISP runs as either:
1. **Docker containers** (easiest for testing)
2. **Virtual machine** (recommended for production)
3. **Native installation** (most complex but most customizable)

**Components:**
- **Web Application:** PHP (CakePHP framework)
- **Database:** MySQL/MariaDB
- **Background Workers:** Python (for automation tasks)
- **Cache:** Redis
- **Message Queue:** Redis

### System Requirements

**Minimum (Development/Testing):**
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space
- Docker or VM environment

**Recommended (Production):**
- 4+ CPU cores
- 8+ GB RAM
- 100+ GB disk space (for IoC database growth)
- Dedicated server or VM

### Installation Requirements

**Option 1: Docker (Easiest)**
```bash
# Install Docker Desktop (if not already installed)
brew install --cask docker

# Clone MISP Docker repository
git clone https://github.com/MISP/misp-docker.git
cd misp-docker

# Configure environment
cp template.env .env
# Edit .env with secure passwords

# Launch MISP
docker-compose up -d

# Access UI
open https://localhost
# Default credentials: admin@admin.test / admin (change immediately)
```

**Option 2: VM with Pre-built Image**
- Download MISP VM from: https://vm.misp-project.org/
- Import into VirtualBox or VMware Fusion
- Configure network settings
- Access via browser

**Estimated Setup Time:**
- Docker: 20-40 minutes
- VM: 30-60 minutes

### Use Cases for Security Research

1. **IoC Sharing & Collaboration**
   - Share indicators with trusted communities
   - Receive threat intelligence from partners
   - Build private sharing groups

2. **Incident Response**
   - Document IoCs from security incidents
   - Correlate with known threats
   - Generate feeds for SIEM/EDR integration

3. **Threat Hunting**
   - Search for IoCs across historical data
   - Identify correlated indicators
   - Build threat hunting queries

4. **Malware Analysis Documentation**
   - Document malware samples and IoCs
   - Track malware families and variants
   - Share analysis with research community

5. **Feed Generation**
   - Create custom threat feeds for security tools
   - Export IoCs to firewalls, IDS/IPS, SIEM
   - Automate threat intelligence distribution

### When to Use MISP

**Use MISP when you need:**
- Dedicated IoC database and sharing platform
- Collaboration with other organizations/researchers
- Automated correlation of threat intelligence
- Integration with security tools (SIEM, EDR, firewalls)
- SOC operations with threat intelligence requirements
- Formal incident response program with IoC tracking
- Community-driven threat intelligence

**Don't use MISP when:**
- You need simple visualization (use Gephi)
- You don't have infrastructure for Docker/VM
- You need broader threat intelligence (use OpenCTI)
- You're doing one-off reconnaissance (use individual OSINT tools)
- You don't need IoC sharing capabilities

### Integration with OSINT Tools

MISP integrates with numerous OSINT and security tools:
- TheHive (incident response)
- Cortex (observable analysis)
- VirusTotal
- Shodan
- PassiveTotal
- Abuse.ch feeds
- AlienVault OTX
- And many more via modules

### MISP vs OpenCTI

| Feature | MISP | OpenCTI |
|---------|------|---------|
| **Primary Focus** | IoC sharing & correlation | Comprehensive threat intelligence management |
| **Data Model** | Events with attributes | STIX 2.1 knowledge graph |
| **Best For** | SOC operations, IoC management | Threat intelligence programs, APT tracking |
| **Collaboration** | Event-based sharing between organizations | Knowledge graph sharing |
| **MITRE ATT&CK** | Basic support via galaxies | Deep integration with relationship mapping |
| **Resource Usage** | Lighter (4 GB RAM sufficient) | Heavier (8+ GB RAM recommended) |
| **Learning Curve** | Moderate | Moderate to steep |
| **Community** | Large, mature (10+ years) | Growing, modern architecture |

**Can Use Both:** OpenCTI can connect to MISP instances as a data source.

---

## 🎯 Decision Framework: When to Install What?

### For Most OSINT Research (Lightweight Approach)

**Install Now:**
- ✅ **Gephi** - Visual relationship mapping
- ✅ **Maltego** - Automated reconnaissance and transforms
- ✅ **Individual OSINT tools** (theHarvester, Shodan CLI, Spiderfoot, etc.)

**Workflow:**
1. Collect data with OSINT tools
2. Visualize relationships in Gephi
3. Export visualizations for reports

**This covers 80% of OSINT use cases without heavy infrastructure.**

---

### For Dedicated Threat Intelligence Program

**Install OpenCTI when:**
- You need centralized threat intelligence repository
- You want automated threat feed ingestion from many sources
- You're tracking APT groups and campaigns
- You need MITRE ATT&CK integration
- You're building a threat intelligence program
- You have 8+ GB RAM and Docker infrastructure available

**Typical Users:**
- SOC analysts
- Threat intelligence analysts
- Security researchers (advanced)
- Red teams tracking adversary TTPs

---

### For IoC Management & Sharing

**Install MISP when:**
- You need to share IoCs with other organizations
- You're running SOC operations with IoC tracking
- You need automated correlation of indicators
- You want to generate threat feeds for security tools
- You're doing formal incident response with IoC documentation
- You have 4+ GB RAM and Docker/VM infrastructure

**Typical Users:**
- SOC teams
- Incident responders
- ISACs and threat sharing communities
- Malware analysts

---

### Current Needs (Recommendation)

**Currently Installed & Ready:**
- ✅ **Gephi** - Immediate value for visualizing OSINT data

**Document for Future:**
- 📄 **OpenCTI** - Install when building formal threat intelligence program
- 📄 **MISP** - Install when needing IoC sharing and correlation

**Rationale:**
- Gephi provides immediate visualization value with zero infrastructure overhead
- OpenCTI and MISP require Docker infrastructure and significant resources
- Most security research can be done with Maltego + Gephi + individual OSINT tools
- Full threat intelligence platforms are best installed when there's a specific operational need

**When to Revisit:**
- If starting regular threat intelligence work → Install OpenCTI
- If needing to share IoCs with partners → Install MISP
- If building SOC operations → Install MISP first, OpenCTI later
- If tracking APT campaigns → Install OpenCTI

---

## 📊 Resource Comparison

| Tool | RAM Required | Disk Space | Complexity | Install Time | Ready to Use |
|------|--------------|------------|------------|--------------|--------------|
| **Gephi** | Included in Java (~200 MB) | 500 MB | Low | 5 min | ✅ YES |
| **OpenCTI** | 8+ GB dedicated | 50+ GB | High | 30-60 min | ❌ NO |
| **MISP** | 4+ GB dedicated | 20+ GB | Moderate-High | 20-60 min | ❌ NO |

---

## 🚀 Quick Start with Gephi

### Example: Visualizing Domain Infrastructure

**Step 1: Collect Data**
```bash
# Use OSINT tools to gather domain relationships
# Export to CSV format
```

**Step 2: Prepare CSV Files**

`nodes.csv`:
```csv
Id,Label,Type
1,target.com,domain
2,192.168.1.1,ip
3,admin@target.com,email
4,ns1.hosting.com,nameserver
```

`edges.csv`:
```csv
Source,Target,Type
1,2,resolves_to
3,1,registered
1,4,uses_nameserver
```

**Step 3: Import to Gephi**
1. Launch Gephi: `open -a Gephi`
2. File → Import Spreadsheet
3. Load nodes.csv (Node Table)
4. Load edges.csv (Edge Table)

**Step 4: Visualize**
1. Layout → Force Atlas 2 → Run
2. Appearance → Nodes → Color by Type
3. Appearance → Nodes → Size by Degree
4. Preview → Export to PNG/SVG

---

## 📚 Additional Resources

### Gephi
- Official Documentation: https://gephi.org/users/
- Tutorial Playlist: https://gephi.org/users/tutorial-visualization/
- Sample Datasets: https://github.com/gephi/gephi/wiki/Datasets

### OpenCTI
- Official Docs: https://docs.opencti.io/
- Demo Instance: https://demo.opencti.io/
- YouTube Channel: https://www.youtube.com/@OpenCTI

### MISP
- Official Docs: https://www.misp-project.org/documentation/
- Training Materials: https://www.misp-project.org/misp-training/
- Public Communities: https://www.misp-project.org/communities/

---

## ✅ Installation Summary

| Tool | Status | Location | Command to Launch |
|------|--------|----------|-------------------|
| **Gephi** | ✅ INSTALLED | /Applications/Gephi.app | `open -a Gephi` |
| **OpenCTI** | 📄 DOCUMENTED | Not installed | See installation section above |
| **MISP** | 📄 DOCUMENTED | Not installed | See installation section above |

**Java Runtime:** ✅ OpenJDK 25 installed and working

---

**Last Updated:** 2025-11-11
**Next Review:** When starting dedicated threat intelligence work or IoC sharing operations
