import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TrendingUp } from "lucide-react"

export default function ProgressPage() {
  // TODO: Load your progress data
  // Example structure:
  // const progressMetrics = [
  //   {
  //     category: "Category Name",
  //     current: 75,
  //     target: 100,
  //     trend: "up" | "down" | "stable"
  //   }
  // ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Progress Tracking</h1>
        <p className="text-lg text-gray-600">
          {/* TODO: Add your page description */}
          Track progress toward goals and targets
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-8 border-l-4 border-l-[#2e7de9]">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-[#2e7de9]" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Program Completion</span>
              <span className="text-lg font-bold text-[#2e7de9]">
                {/* TODO: Overall percentage */}
                XX%
              </span>
            </div>
            <Progress value={75} max={100} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Progress by Category - TODO: Map over your progress metrics */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {/* TODO: Category name */}
              Example Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Current Progress</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {/* TODO: Current/Target */}
                    XX / XXX
                  </span>
                  <span className="text-lg font-bold text-[#33b579]">
                    {/* TODO: Percentage */}
                    XX%
                  </span>
                </div>
              </div>
              <Progress value={60} max={100} />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Current</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {/* TODO: Current value */}
                    XX
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Target</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {/* TODO: Target value */}
                    XXX
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Remaining</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {/* TODO: Remaining value */}
                    XX
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
