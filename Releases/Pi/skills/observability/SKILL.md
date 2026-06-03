---
name: observability
description: System monitoring, cost tracking, and performance analysis. Metrics collection, logging patterns, alerting rules, dashboard design, tracing, cost attribution, and optimization. USE WHEN monitor, observability, metrics, logging, alert, dashboard, tracing, cost, performance, SLA, SLO, uptime.
metadata:
  author: pai
  version: 1.0.0
---

# Observability — Monitoring & Analysis

## Three Pillars

1. **Logs** — Discrete events with timestamps and context
2. **Metrics** — Numeric measurements over time (counters, gauges, histograms)
3. **Traces** — End-to-end request flow across services

## Key Metrics

| Category | Examples |
|----------|----------|
| **RED** (Rate, Errors, Duration) | Requests/sec, 5xx count, p50/p95/p99 latency |
| **USE** (Utilization, Saturation, Errors) | CPU %, queue depth, disk errors |
| **Business** | Active users, revenue, conversion rate |
| **Cost** | Compute, storage, bandwidth, API calls |

## Alerting Rules

- **Threshold**: Alert when metric crosses boundary (CPU > 90%)
- **Anomaly**: Alert when metric deviates from baseline (3 std)
- **Rate**: Alert on sudden change speed (5xx rate doubled)
- **Dead man**: Alert when data stops arriving

## Dashboard Design

- Top row: Health (RED metrics, status)
- Middle: System details (USE metrics per service)
- Bottom: Business + cost metrics
- Time range: Last hour, last 24h, last 7d

## Cost Tracking

1. Tag all resources (project, service, environment)
2. Track unit economics (cost per request, per user)
3. Set budgets per tag
4. Alert on cost anomalies (spend > 20% above forecast)
