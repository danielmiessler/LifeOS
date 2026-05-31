---
name: architecture
description: System architecture analysis. Component identification, dependency mapping, data flow tracing, interface contracts, deployment topology, and architectural decision records. USE WHEN architecture, system design, component diagram, dependency map, data flow, architecture review, technical design, system analysis, ADR, architecture decision.
metadata:
  author: pai
  version: 1.0.0
---

# Architecture — System Analysis

## Analysis Dimensions

1. **Components** — Identify all system modules/services
2. **Dependencies** — Map what depends on what (direction, strength)
3. **Data Flow** — Trace data through the system (sources → transforms → sinks)
4. **Interfaces** — Contracts between components (protocol, schema, SLA)
5. **Deployment** — Physical/logical topology (nodes, networks, regions)
6. **Quality Attributes** — Performance, scalability, reliability, security

## Dependency Mapping

| Symbol | Meaning |
|--------|---------|
| A → B | A depends on B |
| A ⇄ B | Bidirectional dependency |
| A ─ B | Peer relationship |
| A … B | Async/messaging dependency |

Flag **circular dependencies** — they are design smells.

## Flow Tracing

For any critical flow (request, event, transaction):
1. Entry point → components touched → exit point
2. Identify each hop's protocol and data shape
3. Note error handling at each hop
4. Estimate latency budget per hop

## ADR Format
```
ADR-NNN: Title
Status: [Proposed | Accepted | Deprecated | Superseded]
Context: What led to this decision
Decision: The chosen approach
Consequences: Trade-offs and impact
```
