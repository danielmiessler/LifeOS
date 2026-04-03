import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, AlertTriangle } from "lucide-react"

export default function VulnerabilitiesPage() {
  // TODO: Load your vulnerabilities data
  // Example structure:
  // const vulnerabilities = [
  //   {
  //     id: "V001",
  //     title: "Vulnerability title",
  //     severity: "Critical" | "High" | "Medium" | "Low",
  //     status: "Open" | "In Progress" | "Resolved",
  //     affectedSystem: "System name",
  //     daysOpen: 5
  //   }
  // ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Vulnerabilities</h1>
        <p className="text-lg text-gray-600">
          {/* TODO: Add your page description */}
          Active security vulnerabilities and remediation status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-l-4 border-l-[#f52a65]">
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <AlertTriangle className="h-4 w-4 mr-2 text-[#f52a65]" />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#f52a65]">
              {/* TODO: Critical count */}
              X
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#f0a020]">
          <CardHeader>
            <CardTitle className="text-sm">High</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#f0a020]">
              {/* TODO: High count */}
              X
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#2e7de9]">
          <CardHeader>
            <CardTitle className="text-sm">Medium</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#2e7de9]">
              {/* TODO: Medium count */}
              X
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#33b579]">
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <Shield className="h-4 w-4 mr-2 text-[#33b579]" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#33b579]">
              {/* TODO: Resolved count */}
              XX
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vulnerabilities Table - TODO: Map over your vulnerabilities data */}
      <Card>
        <CardHeader>
          <CardTitle>Active Vulnerabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>System</TableHead>
                <TableHead>Days Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* TODO: Map over vulnerabilities */}
              <TableRow>
                <TableCell className="font-mono">V001</TableCell>
                <TableCell>Example vulnerability</TableCell>
                <TableCell>
                  <Badge variant="destructive">Critical</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="warning">In Progress</Badge>
                </TableCell>
                <TableCell>System Name</TableCell>
                <TableCell>5 days</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
