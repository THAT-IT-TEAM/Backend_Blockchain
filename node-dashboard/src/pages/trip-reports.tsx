import React, { useEffect, useState } from "react";
import api from "@/services/api";
import { getCurrentUser } from "@/services/auth"; // Assuming useAuth provides user role
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast"; // Assuming you have a toast component

interface TripReport {
  id: string;
  trip_id: string;
  report_name: string;
  summary: string;
  total_expenses_amount: number;
  generated_at: string;
  created_by_user_id: string;
  status: string;
}

const apiService = api;

const TripReportsPage: React.FC = () => {
  const user = getCurrentUser(); // Get current user from auth context
  const isAdmin = user?.role === "admin";

  const [reports, setReports] = useState<TripReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentReport, setCurrentReport] = useState<TripReport | null>(null);
  const [formState, setFormState] = useState({
    trip_id: "",
    report_name: "",
    summary: "",
    status: "draft",
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTripReports();
      setReports(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch trip reports");
      toast({
        title: "Error",
        description: err.message || "Failed to fetch trip reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setCurrentReport(null);
    setFormState({
      trip_id: "",
      report_name: "",
      summary: "",
      status: "draft",
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (report: TripReport) => {
    setCurrentReport(report);
    setFormState({
      trip_id: report.trip_id,
      report_name: report.report_name,
      summary: report.summary,
      status: report.status,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !isAdmin ||
      !window.confirm("Are you sure you want to delete this report?")
    ) {
      return;
    }
    try {
      await apiService.deleteTripReport(id);
      toast({
        title: "Success",
        description: "Trip report deleted successfully.",
      });
      fetchReports();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete trip report",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentReport) {
        // Update existing report
        await apiService.updateTripReport(currentReport.id, formState);
        toast({
          title: "Success",
          description: "Trip report updated successfully.",
        });
      } else {
        // Create new report
        await apiService.createTripReport(formState);
        toast({
          title: "Success",
          description: "Trip report created successfully.",
        });
      }
      setIsModalOpen(false);
      fetchReports();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save trip report",
        variant: "destructive",
      });
    }
  };

  if (loading)
    return <div className="text-center">Loading trip reports...</div>;
  if (error)
    return <div className="text-center text-red-500">Error: {error}</div>;

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Trip Reports</CardTitle>
        <CardDescription>
          Manage and view detailed reports for trips.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            <Button onClick={handleCreateClick}>Create New Report</Button>
          </div>
        )}
        {reports.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No trip reports found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Trip ID</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Total Expenses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead>Created By</TableHead>
                  {isAdmin && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.report_name}
                    </TableCell>
                    <TableCell>{report.trip_id}</TableCell>
                    <TableCell>{report.summary}</TableCell>
                    <TableCell>
                      $
                      {report.total_expenses_amount
                        ? report.total_expenses_amount.toFixed(2)
                        : "0.00"}
                    </TableCell>
                    <TableCell>{report.status}</TableCell>
                    <TableCell>
                      {new Date(report.generated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{report.created_by_user_id}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleEditClick(report)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(report.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentReport ? "Edit Trip Report" : "Create New Trip Report"}
            </DialogTitle>
            <DialogDescription>
              {currentReport
                ? "Make changes to this trip report here."
                : "Fill in the details for a new trip report."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="report_name" className="text-right">
                Report Name
              </Label>
              <Input
                id="report_name"
                value={formState.report_name}
                onChange={(e) =>
                  setFormState({ ...formState, report_name: e.target.value })
                }
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="trip_id" className="text-right">
                Trip ID
              </Label>
              <Input
                id="trip_id"
                value={formState.trip_id}
                onChange={(e) =>
                  setFormState({ ...formState, trip_id: e.target.value })
                }
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="summary" className="text-right">
                Summary
              </Label>
              <Textarea
                id="summary"
                value={formState.summary}
                onChange={(e) =>
                  setFormState({ ...formState, summary: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Input
                id="status"
                value={formState.status}
                onChange={(e) =>
                  setFormState({ ...formState, status: e.target.value })
                }
                className="col-span-3"
              />
            </div>
            <DialogFooter>
              <Button type="submit">
                {currentReport ? "Save Changes" : "Create Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TripReportsPage;
