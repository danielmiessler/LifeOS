import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown } from "lucide-react"

export default function OverviewPage() {
  // TODO: Load your project metrics data
  // Example structure:
  // const metrics = {
  //   timeToDetect: { before: 81, after: 9, improvement: 89 },
  //   timeToInvestigate: { before: 48, after: 6, improvement: 87 },
  //   // ... more metrics
  // }

  return (
    <div className="p-8">
      {/* Hero Section */}
      <div className="mb-12 rounded-2xl bg-gradient-to-br from-[#2e7de9]/10 via-[#9854f1]/5 to-[#33b579]/10 p-12 border border-[#2e7de9]/20">
        <div className="max-w-4xl">
          <h2 className="text-sm font-semibold text-[#2e7de9] uppercase tracking-wide mb-2">
            {/* TODO: Add your section label */}
            Dashboard Overview
          </h2>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            {/* TODO: Add your project name */}
            Your Project Name
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            {/* TODO: Add your project description */}
            Project description goes here
          </p>
          <div className="inline-block bg-white rounded-lg px-6 py-4 shadow-lg border border-[#33b579]/30">
            <p className="text-3xl font-bold text-[#33b579]">
              {/* TODO: Add your key metric */}
              Key achievement metric
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {/* TODO: Add metric context */}
              Context for the metric
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Executive Summary</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="text-lg text-gray-700 leading-relaxed">
              {/* TODO: Add your executive summary text */}
              Your executive summary goes here. Describe your project's achievements,
              key performance indicators, and strategic value.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Metric 1 - TODO: Replace with your data */}
          <Card className="border-l-4 border-l-[#33b579] hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Metric 1 Name
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold text-gray-900">
                    {/* TODO: Current value */}
                    XX
                  </span>
                  <div className="flex items-center text-[#33b579]">
                    <TrendingDown className="h-4 w-4 mr-1" />
                    <span className="text-lg font-semibold">
                      {/* TODO: Improvement % */}
                      XX%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 pt-2">
                  {/* TODO: Metric description */}
                  Description of this metric
                </p>
              </div>
            </CardContent>
          </Card>

          {/* TODO: Add more metric cards following the same pattern */}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Stat 1</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#2e7de9]">
              {/* TODO: Add stat value */}
              XX
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {/* TODO: Add stat description */}
              Description
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stat 2</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#9854f1]">
              {/* TODO: Add stat value */}
              XX
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {/* TODO: Add stat description */}
              Description
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stat 3</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-[#33b579]">
              {/* TODO: Add stat value */}
              XX
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {/* TODO: Add stat description */}
              Description
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
