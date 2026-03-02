// Dashboard Template Data
// Replace this example data with your actual project data

// Example metrics structure
export const metrics = {
  timeToDetect: {
    before: 81,
    after: 9,
    unit: 'hours',
    improvement: 89,
  },
  timeToInvestigate: {
    before: 82,
    after: 14,
    unit: 'hours',
    improvement: 83,
  },
  // TODO: Add your own metrics following this pattern
}

// Example projects structure
export const projects = [
  {
    id: 'P001',
    name: 'Example Project',
    priority: 'Critical',
    status: 'In Progress',
    completion: 65,
    budget: {
      oneTime: 100000,
      monthly: 5000,
    },
    description: 'Example project description',
  },
  // TODO: Add your projects here
]

export const budgetSummary = {
  totalOneTime: 100000,
  totalMonthly: 5000,
  // TODO: Update with your budget totals
}

// Example teams structure
export const teams = [
  {
    id: 'T001',
    name: 'Example Team',
    lead: 'Team Lead Name',
    size: 12,
    coverage: 'Full',
    projects: ['P001'],
    // TODO: Add your team-specific fields
  },
  // TODO: Add your teams here
]

// Example vulnerabilities structure
export const vulnerabilities = [
  {
    id: 'V001',
    title: 'Example Vulnerability',
    severity: 'Critical',
    status: 'Open',
    affectedSystem: 'System Name',
    daysOpen: 5,
    // TODO: Add your vulnerability fields
  },
  // TODO: Add your vulnerabilities here
]

export const vulnerabilitySummary = {
  total: 100,
  critical: 5,
  high: 20,
  medium: 75,
  // TODO: Update with your vulnerability counts
}

// Example progress metrics
export const progressMetrics = [
  {
    category: 'Category Name',
    current: 75,
    target: 100,
    unit: 'units',
    trend: 'up',
    // TODO: Add your progress metrics
  },
  // TODO: Add more progress categories
]

// TypeScript interfaces for type safety (optional)
export interface Project {
  id: string
  name: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'In Progress' | 'Planning' | 'Complete' | 'Not Started'
  completion: number
  budget: {
    oneTime: number
    monthly: number
  }
  description: string
  highlight?: boolean
}

export interface Team {
  id: string
  name: string
  lead: string
  size: number
  coverage: 'Full' | 'Partial' | 'None'
  projects: string[]
}

export interface Vulnerability {
  id: string
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'Open' | 'In Progress' | 'Resolved'
  affectedSystem: string
  daysOpen: number
}

export interface ProgressMetric {
  category: string
  current: number
  target: number
  unit: string
  trend: 'up' | 'down' | 'stable'
}
