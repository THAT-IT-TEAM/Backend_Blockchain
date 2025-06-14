import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/router";
import { isAuthenticated } from "@/services/auth";

interface UserDashboardSummary {
  currentExpenditure: number;
  budget: number;
  vendors: { distinctVendors: number };
  auditSyncRate: number;
  activeProjects: number;
  expenditureGraph: { monthlyAmount: number; month: string }[];
}

export default function UserDashboardTestPage() {
  const [summary, setSummary] = useState<UserDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await api.getUserDashboardSummary();
        setSummary(data);
      } catch (err: any) {
        console.error("Failed to fetch user dashboard summary:", err);
        setError(err.message || "Failed to load dashboard summary.");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [router]);

  if (loading)
    return (
      <div className="container mx-auto p-4">Loading user dashboard...</div>
    );
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-600">Error: {error}</div>
    );
  if (!summary)
    return (
      <div className="container mx-auto p-4">No summary data available.</div>
    );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Dashboard Summary</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Total Expenditure</h2>
          <p className="text-3xl font-bold">
            ${summary.currentExpenditure.toFixed(2)}
          </p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Assigned Budget</h2>
          <p className="text-3xl font-bold">${summary.budget.toFixed(2)}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Distinct Vendors</h2>
          <p className="text-3xl font-bold">
            {summary.vendors.distinctVendors}
          </p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Audit Sync Rate</h2>
          <p className="text-3xl font-bold">
            {summary.auditSyncRate.toFixed(2)}%
          </p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Active Projects</h2>
          <p className="text-3xl font-bold">{summary.activeProjects}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Monthly Expenditure Trend</h2>
      <div className="bg-white shadow-md rounded-lg p-4">
        <ul className="list-disc pl-5">
          {summary.expenditureGraph.length > 0 ? (
            summary.expenditureGraph.map((item) => (
              <li key={item.month}>
                {item.month}: ${item.monthlyAmount.toFixed(2)}
              </li>
            ))
          ) : (
            <li>No expenditure data for graph.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
