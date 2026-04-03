import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

export default function TeamsPage() {
  // TODO: Load your teams data
  // Example structure:
  // const teams = [
  //   {
  //     id: "T001",
  //     name: "Team Name",
  //     coverage: "Full" | "Partial" | "None",
  //     members: 12,
  //     projects: ["P001", "P002"]
  //   }
  // ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Teams</h1>
        <p className="text-lg text-gray-600">
          {/* TODO: Add your page description */}
          Team structure and responsibilities
        </p>
      </div>

      {/* Summary Card */}
      <Card className="mb-8 border-l-4 border-l-[#2e7de9]">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-[#2e7de9]" />
            Teams Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-3xl font-bold text-[#2e7de9]">
                {/* TODO: Total teams */}
                XX
              </p>
              <p className="text-sm text-gray-600 mt-1">Total Teams</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#33b579]">
                {/* TODO: Teams with full coverage */}
                XX
              </p>
              <p className="text-sm text-gray-600 mt-1">Full Coverage</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {/* TODO: Total team members */}
                XXX
              </p>
              <p className="text-sm text-gray-600 mt-1">Team Members</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams Grid - TODO: Map over your teams data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {/* TODO: Team name */}
              Example Team
            </CardTitle>
            <Badge variant="primary">
              {/* TODO: Coverage status */}
              Full Coverage
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Team Members</p>
                <p className="text-2xl font-bold text-gray-900">
                  {/* TODO: Member count */}
                  XX
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Active Projects</p>
                {/* TODO: Map over project IDs */}
                <Badge variant="secondary" className="mr-1">P001</Badge>
                <Badge variant="secondary">P002</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
