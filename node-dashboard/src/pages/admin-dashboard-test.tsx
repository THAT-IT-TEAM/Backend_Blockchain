import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/router";
import { isAuthenticated, hasRole } from "@/services/auth";

interface AdminDashboardSummary {
  pendingApprovals: number;
  rejectedRequests: number;
  unverifiedVendors: number;
  overallExpenditureGraph: { monthlyAmount: number; month: string }[];
  highPriorityExpenses: number; // Placeholder for now
}

export default function AdminDashboardTestPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiToken, setAiToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated() || !hasRole("admin")) {
      router.push("/login");
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await api.getAdminDashboardSummary();
        setSummary(data);
      } catch (err: any) {
        console.error("Failed to fetch admin dashboard summary:", err);
        setError(err.message || "Failed to load admin dashboard summary.");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [router]);

  const handleGenerateAiToken = async () => {
    setTokenError(null);
    setAiToken(null);
    try {
      const response = await api.generateAiServiceToken();
      if (response && response.token) {
        setAiToken(response.token);
      } else {
        setTokenError("Failed to retrieve token from response.");
      }
    } catch (err: any) {
      console.error("Failed to generate AI service token:", err);
      setTokenError(err.response?.data?.error || err.message || "Error generating token.");
    }
  };

  if (loading)
    return (
      <div className="container mx-auto p-4">Loading admin dashboard...</div>
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
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard Summary</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          <p className="text-3xl font-bold">{summary.pendingApprovals}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Rejected Requests</h2>
          <p className="text-3xl font-bold">{summary.rejectedRequests}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">Unverified Vendors</h2>
          <p className="text-3xl font-bold">{summary.unverifiedVendors}</p>
        </div>
        <div className="bg-white shadow-md rounded-lg p-4">
          <h2 className="text-lg font-semibold">High Priority Expenses</h2>
          <p className="text-3xl font-bold">
            {summary.highPriorityExpenses} (Placeholder)
          </p>
        </div>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Overall Expenditure Trend</h2>
      <div className="bg-white shadow-md rounded-lg p-4">
        <ul className="list-disc pl-5">
          {summary.overallExpenditureGraph.length > 0 ? (
            summary.overallExpenditureGraph.map((item) => (
              <li key={item.month}>
                {item.month}: ${item.monthlyAmount.toFixed(2)}
              </li>
            ))
          ) : (
            <li>No overall expenditure data for graph.</li>
          )}
        </ul>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">AI Service Token</h2>
      <div className="bg-white shadow-md rounded-lg p-4">
        <button
          onClick={handleGenerateAiToken}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Generate AI Service Token
        </button>

        {tokenError && (
          <p className="text-red-600 mt-2">Error: {tokenError}</p>
        )}

        {aiToken && (
          <div className="mt-4">
            <p className="font-semibold">Generated Token:</p>
            <textarea
              readOnly
              value={aiToken}
              rows={5}
              className="w-full p-2 border rounded-md bg-gray-100 text-gray-800 break-all"
            ></textarea>
            <p className="text-sm text-gray-600 mt-1">
              Copy this token and add it to your `Backend_Blockchain/ai/.env` file as `AI_SERVICE_JWT`.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
