// TELOS Report Data Structure
// This file is auto-generated from TELOS analysis
// Replace placeholder content with actual analysis results

export interface Finding {
  id: string
  title: string
  description: string
  evidence: string
  source: string
  severity: "critical" | "high" | "medium" | "low"
}

export interface Recommendation {
  id: string
  title: string
  description: string
  priority: "immediate" | "short-term" | "long-term"
}

export interface TimelinePhase {
  phase: string
  title: string
  description: string
  duration: string
}

export interface ReportData {
  // Meta
  clientName: string
  reportTitle: string
  reportDate: string
  classification: string

  // Executive Summary
  executiveSummary: {
    context: string
    methodology: {
      interviewCount: number
      roles: string[]
    }
    keyFindings: string[]
    primaryRecommendation: string
    expectedOutcomes: string[]
  }

  // Situation Assessment (from Opening Context)
  situationAssessment: {
    currentState: string
    clientAsk: string
    whyNow: string
  }

  // Key Findings (from Evidence section)
  findings: Finding[]

  // Risk Analysis (from Stakes section)
  riskAnalysis: {
    existentialRisks: string[]
    competitiveThreats: string[]
    timelinePressures: string
  }

  // The Pivot - Strategic Opportunity
  strategicOpportunity: {
    goodNews: string
    requirements: string[]
  }

  // Recommendations (from Requirements section)
  recommendations: Recommendation[]

  // Vision (from Vision section)
  targetState: {
    description: string
    keyCapabilities: string[]
    successMetrics: string[]
  }

  // Implementation Roadmap
  roadmap: TimelinePhase[]

  // Call to Action (from Close section)
  callToAction: {
    immediateSteps: string[]
    decisionPoints: string[]
    commitmentRequired: string
  }
}

// Default placeholder data - replace with actual TELOS analysis
export const reportData: ReportData = {
  clientName: "[CLIENT NAME]",
  reportTitle: "Strategic Assessment & Transformation Roadmap",
  reportDate: new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }),
  classification: "CONFIDENTIAL",

  executiveSummary: {
    context: "This report presents findings from our comprehensive TELOS analysis of [CLIENT], conducted to assess strategic readiness and identify transformation opportunities.",
    methodology: {
      interviewCount: 0, // Replace with actual interview count
      roles: [
        // Replace with roles interviewed (by role, not by name)
        "Executive Leadership",
        "Department Heads",
        "Team Leads",
      ],
    },
    keyFindings: [
      "Finding 1 - Replace with actual finding",
      "Finding 2 - Replace with actual finding",
      "Finding 3 - Replace with actual finding",
    ],
    primaryRecommendation: "Based on our analysis, [PRIMARY RECOMMENDATION HERE]",
    expectedOutcomes: [
      "Expected outcome 1",
      "Expected outcome 2",
      "Expected outcome 3",
    ],
  },

  situationAssessment: {
    currentState: "Replace with current state analysis from TELOS",
    clientAsk: "Replace with what the client originally asked for",
    whyNow: "Replace with why this matters now - the underlying drivers",
  },

  findings: [
    {
      id: "F1",
      title: "Finding Title",
      description: "Description of the finding",
      evidence: "Evidence supporting this finding",
      source: "Source (interview, data, observation)",
      severity: "critical",
    },
    // Add more findings from TELOS analysis
  ],

  riskAnalysis: {
    existentialRisks: [
      "Replace with existential risks from TELOS Stakes section",
    ],
    competitiveThreats: [
      "Replace with competitive threats",
    ],
    timelinePressures: "Replace with timeline pressures and urgency factors",
  },

  strategicOpportunity: {
    goodNews: "Replace with the pivot - the good news that there IS a solution",
    requirements: [
      "Requirement 1 - what 'all the way' means",
      "Requirement 2",
      "Requirement 3",
    ],
  },

  recommendations: [
    {
      id: "R1",
      title: "Primary Recommendation",
      description: "Description of the recommendation",
      priority: "immediate",
    },
    // Add more recommendations from TELOS analysis
  ],

  targetState: {
    description: "Replace with the vision description from TELOS",
    keyCapabilities: [
      "Capability 1 enabled by the vision",
      "Capability 2",
      "Capability 3",
    ],
    successMetrics: [
      "Success metric 1",
      "Success metric 2",
      "Success metric 3",
    ],
  },

  roadmap: [
    {
      phase: "Phase 1",
      title: "Foundation",
      description: "Initial phase description",
      duration: "Weeks 1-4",
    },
    {
      phase: "Phase 2",
      title: "Implementation",
      description: "Main implementation phase",
      duration: "Weeks 5-12",
    },
    {
      phase: "Phase 3",
      title: "Optimization",
      description: "Optimization and scaling",
      duration: "Weeks 13-20",
    },
  ],

  callToAction: {
    immediateSteps: [
      "Immediate next step 1",
      "Immediate next step 2",
    ],
    decisionPoints: [
      "Decision point 1 requiring leadership approval",
      "Decision point 2",
    ],
    commitmentRequired: "Replace with what courage/commitment is required from the Close section",
  },
}
