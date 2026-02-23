import type { ChartDataPoint, ChartConfig } from '../types';

export interface ChartDimensions {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private dimensions: ChartDimensions;
  private config: ChartConfig;
  private animationId: number | null = null;
  private currentFrameLabels: { x: number; y: number; width: number; height: number }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    dimensions: ChartDimensions,
    config: ChartConfig
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    this.ctx = ctx;
    this.dimensions = dimensions;
    this.config = config;
    this.setupCanvas(canvas);
  }
  
  private setupCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = this.dimensions.width * dpr;
    canvas.height = this.dimensions.height * dpr;
    canvas.style.width = `${this.dimensions.width}px`;
    canvas.style.height = `${this.dimensions.height}px`;
    this.ctx.scale(dpr, dpr);
  }
  
  private getChartArea() {
    const { width, height, padding } = this.dimensions;
    return {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom
    };
  }

  private calculateNonOverlappingPosition(
    chartArea: { x: number; y: number; width: number; height: number },
    preferredX: number,
    labelWidth: number
  ): { x: number; y: number } | null {
    const LABEL_HEIGHT = 32;
    const MIN_SPACING = 6; // Minimum space between labels (both horizontal and vertical)
    const MAX_HORIZONTAL_OFFSET = 80; // Maximum pixels to shift horizontally
    const HORIZONTAL_OFFSET_STEP = 20; // How much to shift on each cascade level

    // Calculate vertical distribution based on label index
    // Distribute labels across full chart height instead of clustering at top
    const minY = chartArea.y + 20;
    const maxY = chartArea.y + chartArea.height - LABEL_HEIGHT - 10;
    const verticalRange = maxY - minY;

    // Use label index to determine preferred Y position (spreads them out)
    const labelIndex = this.currentFrameLabels.length;
    const preferredY = minY + (labelIndex * 47) % verticalRange; // 47px offset creates good distribution

    // If no existing labels, use distributed position
    if (this.currentFrameLabels.length === 0) {
      return { x: preferredX, y: minY };
    }

    // Helper function to check if a candidate position overlaps with any existing label
    const hasOverlap = (candidateX: number, candidateY: number): boolean => {
      for (const existing of this.currentFrameLabels) {
        // Check 2D bounding box collision
        const candidateRight = candidateX + labelWidth;
        const candidateBottom = candidateY + LABEL_HEIGHT;
        const existingRight = existing.x + existing.width;
        const existingBottom = existing.y + existing.height;

        // Add MIN_SPACING buffer to all sides
        const overlapsX = candidateX - MIN_SPACING < existingRight &&
                         candidateRight + MIN_SPACING > existing.x;
        const overlapsY = candidateY - MIN_SPACING < existingBottom &&
                         candidateBottom + MIN_SPACING > existing.y;

        if (overlapsX && overlapsY) {
          return true;
        }
      }
      return false;
    };

    // Try positions in a cascading pattern starting from preferred Y position
    // For each vertical level, try horizontal offsets (right, then left)
    const verticalStep = LABEL_HEIGHT + MIN_SPACING;

    // Start from preferred Y position and spiral outward (try nearby positions first)
    const tryPositions: number[] = [preferredY];
    for (let offset = verticalStep; offset <= verticalRange; offset += verticalStep) {
      if (preferredY + offset <= maxY) tryPositions.push(preferredY + offset);
      if (preferredY - offset >= minY) tryPositions.push(preferredY - offset);
    }

    let cascadeLevel = 0;
    for (const y of tryPositions) {
      // Try centered first
      if (!hasOverlap(preferredX, y)) {
        return { x: preferredX, y };
      }

      // Try cascading to the right (creates waterfall effect)
      for (let offset = HORIZONTAL_OFFSET_STEP; offset <= MAX_HORIZONTAL_OFFSET; offset += HORIZONTAL_OFFSET_STEP) {
        const rightX = preferredX + offset;
        // Make sure it doesn't go off the right edge
        if (rightX + labelWidth <= chartArea.x + chartArea.width - MIN_SPACING) {
          if (!hasOverlap(rightX, y)) {
            return { x: rightX, y };
          }
        }
      }

      // Try cascading to the left
      for (let offset = HORIZONTAL_OFFSET_STEP; offset <= MAX_HORIZONTAL_OFFSET; offset += HORIZONTAL_OFFSET_STEP) {
        const leftX = preferredX - offset;
        // Make sure it doesn't go off the left edge
        if (leftX >= chartArea.x + MIN_SPACING) {
          if (!hasOverlap(leftX, y)) {
            return { x: leftX, y };
          }
        }
      }

      cascadeLevel++;
    }

    // NO FALLBACK - return null to indicate "no space available"
    // This prevents bunching at bottom - caller will handle by hiding label
    return null;
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height);
    this.currentFrameLabels = []; // Reset label positions for next frame
  }
  
  drawBackground() {
    const chartArea = this.getChartArea();
    
    // Create subtle gradient background
    const gradient = this.ctx.createLinearGradient(
      chartArea.x,
      chartArea.y,
      chartArea.x,
      chartArea.y + chartArea.height
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.02)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      chartArea.x,
      chartArea.y,
      chartArea.width,
      chartArea.height
    );
  }
  
  drawAxes() {
    const chartArea = this.getChartArea();

    // Super thin grey horizontal line only
    this.ctx.strokeStyle = '#444444';  // Dark grey
    this.ctx.lineWidth = 0.5;  // Super thin
    this.ctx.globalAlpha = 0.5;  // Slightly more visible

    // X-axis (horizontal timeline) - ONLY THIS, NO Y-AXIS
    this.ctx.beginPath();
    this.ctx.moveTo(chartArea.x, chartArea.y + chartArea.height);
    this.ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    this.ctx.stroke();

    // Restore alpha
    this.ctx.globalAlpha = 1.0;
  }
  
  drawTimeLabels(timeRange: string) {
    const chartArea = this.getChartArea();

    const labels = this.getTimeLabels(timeRange);
    const spacing = chartArea.width / (labels.length - 1);

    // Draw vertical grid lines at time markers
    this.ctx.save();
    this.ctx.strokeStyle = '#444444';  // Dark grey
    this.ctx.lineWidth = 0.5;  // Super thin
    this.ctx.globalAlpha = 0.5;  // Slightly more visible

    labels.forEach((label, index) => {
      const x = chartArea.x + (index * spacing);

      // Draw vertical grid line
      this.ctx.beginPath();
      this.ctx.moveTo(x, chartArea.y);
      this.ctx.lineTo(x, chartArea.y + chartArea.height);
      this.ctx.stroke();
    });

    this.ctx.restore();

    // Draw text labels - neutral gray, thin weight
    this.ctx.fillStyle = '#565f89';  // Tokyo Night comment gray (neutral)
    this.ctx.font = '400 11px system-ui, -apple-system, sans-serif';
    this.ctx.textBaseline = 'top';

    labels.forEach((label, index) => {
      const x = chartArea.x + (index * spacing);
      const y = chartArea.y + chartArea.height + 10;

      // Adjust alignment for edge labels so they don't get clipped
      if (index === 0) {
        this.ctx.textAlign = 'left';
      } else if (index === labels.length - 1) {
        this.ctx.textAlign = 'right';
      } else {
        this.ctx.textAlign = 'center';
      }

      this.ctx.fillText(label, x, y);
    });
  }
  
  private getTimeLabels(timeRange: string): string[] {
    switch (timeRange) {
      case '1M':
        return ['60s', '45s', '30s', '15s', 'Now'];
      case '2M':
        return ['2m', '90s', '1m', '30s', 'Now'];
      case '4M':
        return ['4m', '3m', '2m', '1m', 'Now'];
      case '8M':
        return ['8m', '6m', '4m', '2m', 'Now'];
      case '16M':
        return ['16m', '12m', '8m', '4m', 'Now'];
      default:
        return ['60s', '45s', '30s', '15s', 'Now'];
    }
  }
  
  drawBars(
    dataPoints: ChartDataPoint[],
    maxValue: number,
    progress: number = 1,
    formatLabel?: (eventTypes: Record<string, number>) => string,
    getSessionColor?: (sessionId: string) => string,
    getAppColor?: (appName: string) => string
  ) {
    const chartArea = this.getChartArea();
    const barCount = this.config.maxDataPoints;
    const totalBarWidth = chartArea.width / barCount;
    const barWidth = this.config.barWidth;
    
    dataPoints.forEach((point, index) => {
      if (point.count === 0) return;
      
      const x = chartArea.x + (index * totalBarWidth) + (totalBarWidth - barWidth) / 2;
      const barHeight = (point.count / maxValue) * chartArea.height * progress;
      const y = chartArea.y + chartArea.height - barHeight;
      
      // Get the dominant session color for this bar
      let barColor = this.config.colors.primary;
      if (getSessionColor && point.sessions && Object.keys(point.sessions).length > 0) {
        // Get the session with the most events in this time bucket
        const dominantSession = Object.entries(point.sessions)
          .sort((a, b) => b[1] - a[1])[0][0];
        barColor = getSessionColor(dominantSession);
      }
      
      // Draw full-height grey vertical lines for all events
      this.ctx.save();
      this.ctx.strokeStyle = '#444444';  // Dark grey (matching grid lines)
      this.ctx.lineWidth = 0.5;  // Super thin (matching grid lines)
      this.ctx.globalAlpha = 0.5;  // Slightly more visible (matching grid lines)

      this.ctx.beginPath();
      this.ctx.moveTo(x + barWidth/2, chartArea.y);
      this.ctx.lineTo(x + barWidth/2, chartArea.y + chartArea.height);
      this.ctx.stroke();

      this.ctx.restore();
      
      // Draw timeline labels (agent name + tool pill only, matching event rows)
      if (point.eventTypes && Object.keys(point.eventTypes).length > 0 && barHeight > 10) {
        const entries = Object.entries(point.eventTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3); // Top 3 event types (used for filtering display)

        if (entries.length > 0) {
          this.ctx.save();

          // Get dominant app name first to include in layout calculation
          let appName = '';
          let agentColor = '#7aa2f7'; // Default blue
          if (point.apps && Object.keys(point.apps).length > 0) {
            const dominantAppEntry = Object.entries(point.apps)
              .sort((a, b) => b[1] - a[1])[0];
            appName = dominantAppEntry[0]; // Full agent ID like "designer:abc123"

            // Extract just the agent name part (before the colon) for color lookup
            const agentNameOnly = appName.split(':')[0].toLowerCase();

            // HARDCODED colors directly - bypass function call
            const colorMap: Record<string, string> = {
              'user': '#C084FC',           // User
              'pentester': '#EF4444',
              'engineer': '#3B82F6',       // blue (senior engineer)
              'designer': '#A855F7',
              'architect': '#A855F7',
              'intern': '#06B6D4',
              'artist': '#06B6D4',
              'perplexity-researcher': '#EAB308',
              'claude-researcher': '#EAB308',
              'gemini-researcher': '#EAB308',
              'grok-researcher': '#EAB308',
              'qatester': '#EAB308',
              'main': '#3B82F6',      // Generic main agent
              'pai': '#3B82F6',       // Main PAI instance
              'claude-code': '#3B82F6',
            };

            agentColor = colorMap[agentNameOnly] || '#7aa2f7';
          }

          // Calculate total width needed (agent name + tool pill only)
          // NO event type icons - only show tool pills matching event rows

          // Measure agent name (strip session ID for display and capitalize)
          this.ctx.font = '700 13px "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace';
          const rawDisplayName = appName ? appName.split(':')[0] : '';
          const displayName = rawDisplayName ? rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1) : '';
          const agentNameWidth = displayName ? this.ctx.measureText(displayName).width : 0;

          // Calculate tool pill width (show actual tool names from events)
          let toolPillWidth = 0;
          let toolName = '';
          const toolPillGap = 6;
          const toolIconSize = 10;
          const toolIconGap = 3;
          if (point.rawEvents && point.rawEvents.length > 0) {
            // Get the most common tool name from rawEvents
            const toolCounts: Record<string, number> = {};
            for (const event of point.rawEvents) {
              const tool = event.payload?.tool_name;
              if (tool) {
                toolCounts[tool] = (toolCounts[tool] || 0) + 1;
              }
            }
            if (Object.keys(toolCounts).length > 0) {
              toolName = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0][0];
              console.log('[Timeline] Found tool:', toolName, 'from', point.rawEvents.length, 'events');
              this.ctx.font = '600 9px "SF Mono", Monaco, monospace';
              const toolTextWidth = this.ctx.measureText(toolName).width;
              const pillPadding = 4;
              toolPillWidth = toolPillGap + toolIconSize + toolIconGap + toolTextWidth + (pillPadding * 2);
            }
          } else {
            console.log('[Timeline] No rawEvents for this point, count:', point.count);
          }

          // Calculate total width for all three pills (agent + event type + tool)
          const pillGapCalc = 6; // Gap between pills
          const pillPaddingCalc = 6; // Horizontal padding per pill

          // Agent pill width
          this.ctx.font = '700 10px "SF Mono", Monaco, monospace';
          const agentPillWidth = appName ? this.ctx.measureText(appName.split(':')[0]).width + (pillPaddingCalc * 2) : 0;

          // Event type pill width (icon + gap + text + padding)
          this.ctx.font = '600 10px system-ui, -apple-system, sans-serif';
          const eventTypeLabel = entries.length > 0 ? this.formatEventTypeLabel(entries[0][0]) : '';
          const eventPillWidth = eventTypeLabel ? 10 + 4 + this.ctx.measureText(eventTypeLabel).width + (pillPaddingCalc * 2) : 0;

          // Tool pill width (already calculated above)
          // toolPillWidth is already set

          const totalWidth = agentPillWidth +
                            (agentPillWidth && eventPillWidth ? pillGapCalc : 0) +
                            eventPillWidth +
                            (eventPillWidth && toolPillWidth ? pillGapCalc : 0) +
                            toolPillWidth;
          const padding = 8;
          const bgWidth = totalWidth + padding * 2;
          const bgHeight = 32;

          // Calculate preferred position (centered on the bar)
          const preferredCenterX = x + barWidth / 2;
          const preferredBgX = preferredCenterX - bgWidth / 2;

          // Use 2D waterfall collision detection to find non-overlapping position
          const position = this.calculateNonOverlappingPosition(chartArea, preferredBgX, bgWidth);

          // If no space available, draw minimal indicator (colored dot) instead of full label
          if (position === null) {
            this.ctx.save();

            // Draw colored dot at event position
            const dotRadius = 4;
            const dotX = preferredCenterX;
            const dotY = chartArea.y + chartArea.height - barHeight / 2;

            // Outer glow
            const glowGradient = this.ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotRadius * 3);
            glowGradient.addColorStop(0, agentColor + '40');
            glowGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(dotX, dotY, dotRadius * 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Solid colored dot
            this.ctx.fillStyle = agentColor;
            this.ctx.beginPath();
            this.ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(dotX - dotRadius/3, dotY - dotRadius/3, dotRadius/2, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();

            // Skip drawing the full label - chart is saturated
            // Continue to next bar
            this.ctx.restore();
            return;
          }

          const bgX = position.x;
          const bgY = position.y;
          const labelY = bgY + bgHeight / 2; // Center Y from top edge

          // CRITICAL: Store label position BEFORE drawing to prevent same-frame collisions
          // This ensures subsequent labels in the same render pass see this label's position
          this.currentFrameLabels.push({
            x: bgX,
            y: bgY,
            width: bgWidth,
            height: bgHeight
          });

          // Draw leader line if label was offset from its preferred position
          const wasOffset = Math.abs(bgX - preferredBgX) > 5;
          if (wasOffset) {
            this.ctx.save();
            this.ctx.strokeStyle = agentColor + '60'; // Semi-transparent agent color
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([3, 3]); // Dotted line

            // Line from event bar center to label left edge
            const eventX = preferredCenterX;
            const eventY = chartArea.y + chartArea.height - barHeight / 2;
            const labelConnectionX = bgX + bgWidth / 2;
            const labelConnectionY = labelY;

            this.ctx.beginPath();
            this.ctx.moveTo(eventX, eventY);
            this.ctx.lineTo(labelConnectionX, labelConnectionY);
            this.ctx.stroke();

            this.ctx.setLineDash([]); // Reset line dash
            this.ctx.restore();
          }

          // Draw THREE pills matching event rows: Agent Name + Event Type + Tool
          let currentX = bgX + padding;
          const pillGap = 7; // gap between pills
          const pillHeight = 21; // pill height (15% larger)
          const pillPadding = 7; // horizontal padding

          // PILL 1: Agent Name Pill (muted style - no border, colored text)
          if (appName) {
            this.ctx.font = '600 11px "SF Mono", Monaco, monospace';
            const agentTextWidth = this.ctx.measureText(displayName).width;
            const agentPillWidth = agentTextWidth + (pillPadding * 2);

            const agentPillX = currentX;
            const agentPillY = labelY - (pillHeight / 2);
            const pillRadius = 4;

            // Background (15% opacity - muted)
            this.ctx.fillStyle = this.hexToRgba(agentColor, 0.15);

            this.ctx.beginPath();
            this.ctx.moveTo(agentPillX + pillRadius, agentPillY);
            this.ctx.lineTo(agentPillX + agentPillWidth - pillRadius, agentPillY);
            this.ctx.quadraticCurveTo(agentPillX + agentPillWidth, agentPillY, agentPillX + agentPillWidth, agentPillY + pillRadius);
            this.ctx.lineTo(agentPillX + agentPillWidth, agentPillY + pillHeight - pillRadius);
            this.ctx.quadraticCurveTo(agentPillX + agentPillWidth, agentPillY + pillHeight, agentPillX + agentPillWidth - pillRadius, agentPillY + pillHeight);
            this.ctx.lineTo(agentPillX + pillRadius, agentPillY + pillHeight);
            this.ctx.quadraticCurveTo(agentPillX, agentPillY + pillHeight, agentPillX, agentPillY + pillHeight - pillRadius);
            this.ctx.lineTo(agentPillX, agentPillY + pillRadius);
            this.ctx.quadraticCurveTo(agentPillX, agentPillY, agentPillX + pillRadius, agentPillY);
            this.ctx.closePath();
            this.ctx.fill();

            // Agent name text (colored)
            this.ctx.fillStyle = agentColor;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(displayName, agentPillX + pillPadding, labelY);

            currentX += agentPillWidth + pillGap;
          }

          // PILL 2: Event Type Pill (muted style - no border, colored text)
          if (entries.length > 0) {
            const dominantEventType = entries[0][0];
            const eventTypeColor = this.getEventTypeColor(dominantEventType);
            const eventTypeLabel = this.formatEventTypeLabel(dominantEventType);
            const eventTypeIcon = this.getEventTypeIconName(dominantEventType);

            this.ctx.font = '600 11px system-ui, -apple-system, sans-serif';
            const eventTextWidth = this.ctx.measureText(eventTypeLabel).width;
            const eventIconSize = 10;
            const eventIconGap = 4;
            const eventPillWidth = eventIconSize + eventIconGap + eventTextWidth + (pillPadding * 2);

            const eventPillX = currentX;
            const eventPillY = labelY - (pillHeight / 2);
            const eventPillRadius = 4;

            // Background (15% opacity - muted)
            this.ctx.fillStyle = this.hexToRgba(eventTypeColor, 0.15);

            this.ctx.beginPath();
            this.ctx.moveTo(eventPillX + eventPillRadius, eventPillY);
            this.ctx.lineTo(eventPillX + eventPillWidth - eventPillRadius, eventPillY);
            this.ctx.quadraticCurveTo(eventPillX + eventPillWidth, eventPillY, eventPillX + eventPillWidth, eventPillY + eventPillRadius);
            this.ctx.lineTo(eventPillX + eventPillWidth, eventPillY + pillHeight - eventPillRadius);
            this.ctx.quadraticCurveTo(eventPillX + eventPillWidth, eventPillY + pillHeight, eventPillX + eventPillWidth - eventPillRadius, eventPillY + pillHeight);
            this.ctx.lineTo(eventPillX + eventPillRadius, eventPillY + pillHeight);
            this.ctx.quadraticCurveTo(eventPillX, eventPillY + pillHeight, eventPillX, eventPillY + pillHeight - eventPillRadius);
            this.ctx.lineTo(eventPillX, eventPillY + eventPillRadius);
            this.ctx.quadraticCurveTo(eventPillX, eventPillY, eventPillX + eventPillRadius, eventPillY);
            this.ctx.closePath();
            this.ctx.fill();

            // Event type icon (colored)
            const eventIconX = eventPillX + pillPadding + eventIconSize / 2;
            const eventIconY = labelY;
            this.drawLucideIcon(eventTypeIcon, eventIconX, eventIconY, eventIconSize, eventTypeColor);

            // Event type text (colored)
            this.ctx.fillStyle = eventTypeColor;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(eventTypeLabel, eventPillX + pillPadding + eventIconSize + eventIconGap, labelY);

            currentX += eventPillWidth + pillGap;
          }

          // PILL 3: Tool Pill (muted style - no border, colored text)
          if (toolName) {
            const toolColor = this.getActualToolTypeColor(toolName);

            this.ctx.font = '500 11px "SF Mono", Monaco, monospace';
            const toolTextWidth = this.ctx.measureText(toolName).width;
            const toolIconSize = 10;
            const toolIconGap = 4;
            const toolPillWidth = toolIconSize + toolIconGap + toolTextWidth + (pillPadding * 2);
            const toolRadius = 4;

            const toolPillX = currentX;
            const toolPillY = labelY - (pillHeight / 2);

            // Background (15% opacity - muted)
            this.ctx.fillStyle = this.hexToRgba(toolColor, 0.15);

            this.ctx.beginPath();
            this.ctx.moveTo(toolPillX + toolRadius, toolPillY);
            this.ctx.lineTo(toolPillX + toolPillWidth - toolRadius, toolPillY);
            this.ctx.quadraticCurveTo(toolPillX + toolPillWidth, toolPillY, toolPillX + toolPillWidth, toolPillY + toolRadius);
            this.ctx.lineTo(toolPillX + toolPillWidth, toolPillY + pillHeight - toolRadius);
            this.ctx.quadraticCurveTo(toolPillX + toolPillWidth, toolPillY + pillHeight, toolPillX + toolPillWidth - toolRadius, toolPillY + pillHeight);
            this.ctx.lineTo(toolPillX + toolRadius, toolPillY + pillHeight);
            this.ctx.quadraticCurveTo(toolPillX, toolPillY + pillHeight, toolPillX, toolPillY + pillHeight - toolRadius);
            this.ctx.lineTo(toolPillX, toolPillY + toolRadius);
            this.ctx.quadraticCurveTo(toolPillX, toolPillY, toolPillX + toolRadius, toolPillY);
            this.ctx.closePath();
            this.ctx.fill();

            // Tool icon (colored)
            const toolIconX = toolPillX + pillPadding + toolIconSize / 2;
            const toolIconY = labelY;
            this.drawToolIcon(toolName, toolIconX, toolIconY, toolIconSize, toolColor);

            // Tool text (colored)
            this.ctx.fillStyle = toolColor;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(toolName, toolPillX + pillPadding + toolIconSize + toolIconGap, labelY);

            currentX += toolPillWidth;
          }

          // Label position already stored BEFORE drawing (see above)
          // This ensures same-frame collision detection works correctly

          this.ctx.restore();
        }
      }
    });
  }

  private getToolName(eventType: string): string {
    const toolMap: Record<string, string> = {
      'PreToolUse': 'Tool',
      'PostToolUse': 'Tool',
      'Notification': 'Alert',
      'Stop': 'Stop',
      'SubagentStop': 'Agent',
      'PreCompact': 'Compact',
      'UserPromptSubmit': 'Prompt',
      'SessionStart': 'Start',
      'SessionEnd': 'End'
    };
    return toolMap[eventType] || '';
  }

  private getToolTypeColor(eventType: string): string {
    const colorMap: Record<string, string> = {
      'PreToolUse': '#e0af68',      // Yellow (Tokyo Night)
      'PostToolUse': '#ff9e64',     // Orange (Tokyo Night) - updated to match EventRow
      'Completed': '#9ece6a',       // Green (Tokyo Night) - for completed events
      'Notification': '#ff9e64',
      'Stop': '#f7768e',
      'SubagentStop': '#bb9af7',
      'PreCompact': '#1abc9c',
      'UserPromptSubmit': '#7dcfff',
      'SessionStart': '#7aa2f7',
      'SessionEnd': '#7aa2f7'
    };
    return colorMap[eventType] || '#7aa2f7';
  }

  private getActualToolTypeColor(toolName: string): string {
    // Tool-specific colors matching EventRow useEventColors composable
    const colorMap: Record<string, string> = {
      'Read': '#7aa2f7',        // Tokyo Night blue
      'Write': '#9ece6a',       // Tokyo Night green
      'Edit': '#e0af68',        // Tokyo Night yellow
      'Bash': '#bb9af7',        // Tokyo Night purple
      'Grep': '#f7768e',        // Tokyo Night red
      'Glob': '#ff9e64',        // Tokyo Night orange
      'Task': '#73daca',        // Tokyo Night cyan
      'WebFetch': '#7dcfff',    // Tokyo Night bright cyan
      'WebSearch': '#7dcfff',   // Tokyo Night bright cyan
      'Skill': '#c0caf5',       // Tokyo Night foreground
      'SlashCommand': '#c0caf5',
      'TodoWrite': '#e0af68',   // Tokyo Night yellow
      'AskUserQuestion': '#bb9af7',
      'NotebookEdit': '#9ece6a',
      'NotebookRead': '#7aa2f7',
      'BashOutput': '#bb9af7',
      'KillShell': '#f7768e',
      'ExitPlanMode': '#9ece6a'
    };
    return colorMap[toolName] || '#7aa2f7'; // Default blue
  }

  private getEventTypeColor(eventType: string): string {
    const colorMap: Record<string, string> = {
      'PreToolUse': '#e0af68',      // Tokyo Night yellow
      'PostToolUse': '#ff9e64',     // Tokyo Night orange
      'Completed': '#9ece6a',       // Tokyo Night green
      'Notification': '#ff9e64',    // Tokyo Night orange
      'Stop': '#f7768e',            // Tokyo Night red
      'SubagentStop': '#bb9af7',    // Tokyo Night magenta
      'PreCompact': '#1abc9c',      // Tokyo Night teal
      'UserPromptSubmit': '#7dcfff', // Tokyo Night cyan
      'SessionStart': '#7aa2f7',    // Tokyo Night blue
      'SessionEnd': '#7aa2f7'       // Tokyo Night blue
    };
    return colorMap[eventType] || '#7aa2f7';
  }

  private formatEventTypeLabel(eventType: string): string {
    const labelMap: Record<string, string> = {
      'PreToolUse': 'Pre-Tool',
      'PostToolUse': 'Post-Tool',
      'UserPromptSubmit': 'Prompt',
      'SessionStart': 'Session Start',
      'SessionEnd': 'Session End',
      'Stop': 'Stop',
      'SubagentStop': 'Subagent',
      'PreCompact': 'Compact',
      'Notification': 'Notification',
      'Completed': 'Completed'
    };
    return labelMap[eventType] || eventType;
  }

  private getEventTypeIconName(eventType: string): string {
    const iconMap: Record<string, string> = {
      'PreToolUse': 'wrench',
      'PostToolUse': 'check-circle',
      'Notification': 'bell',
      'Stop': 'stop-circle',
      'SubagentStop': 'user-check',
      'PreCompact': 'package',
      'UserPromptSubmit': 'message-square',
      'SessionStart': 'rocket',
      'SessionEnd': 'flag',
      'Completed': 'check-circle'
    };
    return iconMap[eventType] || 'check-circle';
  }

  private drawBarGlow(x: number, y: number, width: number, height: number, intensity: number, color?: string) {
    const glowRadius = 10 + (intensity * 20);
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    const glowColor = color || this.config.colors.glow;
    const gradient = this.ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, glowRadius
    );
    gradient.addColorStop(0, this.adjustColorOpacity(glowColor, 0.3 * intensity));
    gradient.addColorStop(1, 'transparent');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      centerX - glowRadius,
      centerY - glowRadius,
      glowRadius * 2,
      glowRadius * 2
    );
  }
  
  private adjustColorOpacity(color: string, opacity: number): string {
    // Simple opacity adjustment - assumes hex color
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return color;
  }

  private hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  drawPulseEffect(x: number, y: number, radius: number, opacity: number) {
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, this.adjustColorOpacity(this.config.colors.primary, opacity));
    gradient.addColorStop(0.5, this.adjustColorOpacity(this.config.colors.primary, opacity * 0.5));
    gradient.addColorStop(1, 'transparent');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  animate(renderCallback: (progress: number) => void) {
    const startTime = performance.now();
    
    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.config.animationDuration, 1);
      
      renderCallback(this.easeOut(progress));
      
      if (progress < 1) {
        this.animationId = requestAnimationFrame(frame);
      } else {
        this.animationId = null;
      }
    };
    
    this.animationId = requestAnimationFrame(frame);
  }
  
  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
  
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  resize(dimensions: ChartDimensions) {
    this.dimensions = dimensions;
    this.setupCanvas(this.ctx.canvas as HTMLCanvasElement);
  }

  // Draw Lucide icons using Path2D with exact SVG paths
  // These match the EXACT icons shown in EventRow.vue

  private drawLucideIcon(iconName: string, x: number, y: number, size: number, color: string) {
    this.ctx.save();

    // Scale and translate to position icon correctly
    // Lucide icons have 24x24 viewBox, scale to our size
    const scale = size / 24;
    this.ctx.translate(x - size/2, y - size/2);
    this.ctx.scale(scale, scale);

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.fillStyle = 'none';

    // Exact Lucide SVG path data (from lucide-vue-next package)
    switch (iconName) {
      case 'wrench': {
        const p = new Path2D('M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z');
        this.ctx.stroke(p);
        break;
      }
      case 'check-circle': {
        const p1 = new Path2D('M22 11.08V12a10 10 0 1 1-5.93-9.14');
        const p2 = new Path2D('M9 11l3 3L22 4');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'bell': {
        const p1 = new Path2D('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9');
        const p2 = new Path2D('M10.3 21a1.94 1.94 0 0 0 3.4 0');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'stop-circle': {
        // Circle
        this.ctx.beginPath();
        this.ctx.arc(12, 12, 10, 0, Math.PI * 2);
        this.ctx.stroke();
        // Rectangle
        this.ctx.strokeRect(9, 9, 6, 6);
        break;
      }
      case 'user-check': {
        // User path
        const p1 = new Path2D('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2');
        // Head circle
        this.ctx.beginPath();
        this.ctx.arc(9, 7, 4, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.stroke(p1);
        // Checkmark
        const p2 = new Path2D('M16 11l2 2l4-4');
        this.ctx.stroke(p2);
        break;
      }
      case 'package': {
        const p1 = new Path2D('M7.5 4.27l9 5.15');
        const p2 = new Path2D('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z');
        const p3 = new Path2D('M3.3 7l8.7 5l8.7-5');
        const p4 = new Path2D('M12 22V12');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        this.ctx.stroke(p4);
        break;
      }
      case 'message-square': {
        const p = new Path2D('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
        this.ctx.stroke(p);
        break;
      }
      case 'rocket': {
        const p1 = new Path2D('M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z');
        const p2 = new Path2D('M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z');
        const p3 = new Path2D('M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0');
        const p4 = new Path2D('M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        this.ctx.stroke(p4);
        break;
      }
      case 'flag': {
        const p1 = new Path2D('M4 15s1-1 4-1s5 2 8 2s4-1 4-1V3s-1 1-4 1s-5-2-8-2s-4 1-4 1z');
        this.ctx.stroke(p1);
        // Line
        this.ctx.beginPath();
        this.ctx.moveTo(4, 15);
        this.ctx.lineTo(4, 22);
        this.ctx.stroke();
        break;
      }
      case 'eye': {
        const p1 = new Path2D('M2 12s3-7 10-7s10 7 10 7s-3 7-10 7s-10-7-10-7');
        const p2 = new Path2D('M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'file-plus': {
        const p1 = new Path2D('M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z');
        const p2 = new Path2D('M14 2v6h6');
        const p3 = new Path2D('M12 18v-6');
        const p4 = new Path2D('M9 15h6');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        this.ctx.stroke(p4);
        break;
      }
      case 'edit-3': {
        const p1 = new Path2D('M12 20h9');
        const p2 = new Path2D('M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1l1-4L16.5 3.5z');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'terminal': {
        const p1 = new Path2D('M4 17l6-6l-6-6');
        const p2 = new Path2D('M12 19h8');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'search': {
        const p1 = new Path2D('M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0');
        const p2 = new Path2D('M21 21l-4.35-4.35');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'folder-search': {
        const p1 = new Path2D('M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z');
        const p2 = new Path2D('M11.5 12.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0');
        const p3 = new Path2D('M13.3 14.3l1.7 1.7');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        break;
      }
      case 'users': {
        const p1 = new Path2D('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2');
        const p2 = new Path2D('M23 21v-2a4 4 0 0 0-3-3.87');
        const p3 = new Path2D('M16 3.13a4 4 0 0 1 0 7.75');
        this.ctx.beginPath();
        this.ctx.arc(9, 7, 4, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        break;
      }
      case 'globe': {
        const p1 = new Path2D('M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0');
        const p2 = new Path2D('M2 12h20');
        const p3 = new Path2D('M12 2a15.3 15.3 0 0 1 4 10a15.3 15.3 0 0 1-4 10a15.3 15.3 0 0 1-4-10a15.3 15.3 0 0 1 4-10z');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        break;
      }
      case 'compass': {
        const p1 = new Path2D('M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0');
        const p2 = new Path2D('M16.24 7.76l-2.12 6.36l-6.36 2.12l2.12-6.36l6.36-2.12z');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'zap': {
        const p1 = new Path2D('M13 2L3 14h9l-1 8l10-12h-9l1-8z');
        this.ctx.stroke(p1);
        break;
      }
      case 'command': {
        const p1 = new Path2D('M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3a3 3 0 0 0-3 3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3a3 3 0 0 0-3-3z');
        this.ctx.stroke(p1);
        break;
      }
      case 'check-square': {
        const p1 = new Path2D('M9 11l3 3L22 4');
        const p2 = new Path2D('M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'message-circle-question': {
        const p1 = new Path2D('M7.9 20A9 9 0 1 0 4 16.1L2 22Z');
        const p2 = new Path2D('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.beginPath();
        this.ctx.arc(12, 17, 0.1, 0, Math.PI * 2);
        this.ctx.fill();
        break;
      }
      case 'book-open': {
        const p1 = new Path2D('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z');
        const p2 = new Path2D('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        break;
      }
      case 'file-text': {
        const p1 = new Path2D('M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z');
        const p2 = new Path2D('M14 2v6h6');
        const p3 = new Path2D('M16 13H8');
        const p4 = new Path2D('M16 17H8');
        const p5 = new Path2D('M10 9H8');
        this.ctx.stroke(p1);
        this.ctx.stroke(p2);
        this.ctx.stroke(p3);
        this.ctx.stroke(p4);
        this.ctx.stroke(p5);
        break;
      }
    }

    this.ctx.restore();
  }

  // Draw tool-specific icons (matching EventRow tool icons)
  private drawToolIcon(toolName: string, x: number, y: number, size: number, color: string) {
    const iconMap: Record<string, string> = {
      'Read': 'eye',
      'Write': 'file-plus',
      'Edit': 'edit-3',
      'Bash': 'terminal',
      'Grep': 'search',
      'Glob': 'folder-search',
      'Task': 'users',
      'WebFetch': 'globe',
      'WebSearch': 'compass',
      'Skill': 'zap',
      'SlashCommand': 'command',
      'TodoWrite': 'check-square',
      'AskUserQuestion': 'message-circle-question',
      'NotebookEdit': 'book-open',
      'NotebookRead': 'file-text',
      'BashOutput': 'terminal',
      'KillShell': 'terminal',
      'ExitPlanMode': 'check-circle'
    };

    const lucideIconName = iconMap[toolName];
    if (lucideIconName) {
      this.drawLucideIcon(lucideIconName, x, y, size, color);
    } else {
      // Fallback: draw small circle for unknown tools
      this.ctx.save();
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size / 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  private drawWrench(x: number, y: number, size: number) {
    // This will be replaced with SVG rendering in the main draw loop
  }

  private drawCheckmark(x: number, y: number, size: number) {
    // CheckCircle icon - matches Lucide CheckCircle (PostToolUse)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Outer circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2.2, 0, Math.PI * 2);
    this.ctx.stroke();

    // Checkmark inside
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/4, y);
    this.ctx.lineTo(x - size/10, y + size/4);
    this.ctx.lineTo(x + size/3, y - size/3);
    this.ctx.stroke();
  }

  private drawBell(x: number, y: number, size: number) {
    // Bell icon - matches Lucide Bell (Notification)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Bell body (curved trapezoid)
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2.2);
    this.ctx.bezierCurveTo(x - size/2.5, y - size/3, x - size/2.5, y, x - size/2.5, y + size/5);
    this.ctx.lineTo(x + size/2.5, y + size/5);
    this.ctx.bezierCurveTo(x + size/2.5, y, x + size/2.5, y - size/3, x, y - size/2.2);
    this.ctx.stroke();

    // Bell bottom line
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2.8, y + size/5);
    this.ctx.lineTo(x + size/2.8, y + size/5);
    this.ctx.stroke();

    // Bell clapper (small arc)
    this.ctx.beginPath();
    this.ctx.arc(x, y + size/2.5, size/10, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawStopCircle(x: number, y: number, size: number) {
    // StopCircle icon - matches Lucide StopCircle (Stop)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Outer circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2.2, 0, Math.PI * 2);
    this.ctx.stroke();

    // Inner square (stroke only, not filled)
    const squareSize = size/3.5;
    this.ctx.beginPath();
    this.ctx.rect(x - squareSize/2, y - squareSize/2, squareSize, squareSize);
    this.ctx.stroke();
  }

  private drawUsers(x: number, y: number, size: number) {
    // Users icon - matches Lucide Users (SubagentStop)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Left person
    this.ctx.beginPath();
    this.ctx.arc(x - size/4, y - size/5, size/7, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(x - size/4, y + size/3, size/3.5, Math.PI * 1.1, Math.PI * 1.9);
    this.ctx.stroke();

    // Right person
    this.ctx.beginPath();
    this.ctx.arc(x + size/4, y - size/5, size/7, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.arc(x + size/4, y + size/3, size/3.5, Math.PI * 1.1, Math.PI * 1.9);
    this.ctx.stroke();
  }

  private drawPackage(x: number, y: number, size: number) {
    // Package icon - matches Lucide Package (PreCompact)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Box outline
    const boxSize = size * 0.85;
    this.ctx.beginPath();
    this.ctx.rect(x - boxSize/2, y - boxSize/2, boxSize, boxSize);
    this.ctx.stroke();

    // Cross lines
    this.ctx.beginPath();
    this.ctx.moveTo(x - boxSize/2, y);
    this.ctx.lineTo(x + boxSize/2, y);
    this.ctx.moveTo(x, y - boxSize/2);
    this.ctx.lineTo(x, y + boxSize/2);
    this.ctx.stroke();
  }

  private drawMessage(x: number, y: number, size: number) {
    // MessageSquare icon - matches Lucide MessageSquare (UserPromptSubmit)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Rounded rectangle
    const rectSize = size * 0.8;
    const radius = size/5;
    this.ctx.beginPath();
    this.ctx.moveTo(x - rectSize/2 + radius, y - rectSize/2);
    this.ctx.arcTo(x + rectSize/2, y - rectSize/2, x + rectSize/2, y + rectSize/2, radius);
    this.ctx.arcTo(x + rectSize/2, y + rectSize/2, x - rectSize/2, y + rectSize/2, radius);
    this.ctx.arcTo(x - rectSize/2, y + rectSize/2, x - rectSize/2, y - rectSize/2, radius);
    this.ctx.arcTo(x - rectSize/2, y - rectSize/2, x + rectSize/2, y - rectSize/2, radius);
    this.ctx.stroke();
  }

  private drawRocket(x: number, y: number, size: number) {
    // Rocket icon - matches Lucide Rocket (SessionStart)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Rocket body
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - size/2);
    this.ctx.lineTo(x - size/3, y);
    this.ctx.lineTo(x - size/3, y + size/3);
    this.ctx.lineTo(x + size/3, y + size/3);
    this.ctx.lineTo(x + size/3, y);
    this.ctx.closePath();
    this.ctx.stroke();

    // Fins
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/3, y + size/6);
    this.ctx.lineTo(x - size/1.8, y + size/2.5);
    this.ctx.moveTo(x + size/3, y + size/6);
    this.ctx.lineTo(x + size/1.8, y + size/2.5);
    this.ctx.stroke();

    // Window
    this.ctx.beginPath();
    this.ctx.arc(x, y - size/8, size/8, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawFlag(x: number, y: number, size: number) {
    // Flag icon - matches Lucide Flag (SessionEnd)
    // Stroke-only, no fill
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Flag pole
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2.5, y - size/2);
    this.ctx.lineTo(x - size/2.5, y + size/2);
    this.ctx.stroke();

    // Flag fabric
    this.ctx.beginPath();
    this.ctx.moveTo(x - size/2.5, y - size/2);
    this.ctx.lineTo(x + size/3, y - size/3);
    this.ctx.lineTo(x + size/3, y + size/8);
    this.ctx.lineTo(x - size/2.5, y + size/6);
    this.ctx.stroke();
  }
}

export function createChartRenderer(
  canvas: HTMLCanvasElement,
  dimensions: ChartDimensions,
  config: ChartConfig
): ChartRenderer {
  return new ChartRenderer(canvas, dimensions, config);
}