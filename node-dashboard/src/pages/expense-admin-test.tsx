import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/router";
import { isAuthenticated, hasRole } from "@/services/auth";

interface Expense {
  id: string;
  amount: number;
  currency: string;
  transaction_date: string;
  vendor_name: string;
  category: string;
  description: string;
  document_id: string;
  payment_method: string;
  tax_amount: number;
  document_url: string;
  extracted_data: string;
  summary: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  trip_id: string;
  blockchain_status: number; // 0: not on blockchain, 1: on blockchain, 2: approved on blockchain, -1: blockchain failed
  blockchain_id: string;
  status: string; // e.g., 'pending', 'approved', 'rejected', 'flagged'
}

export default function ExpenseAdminTestPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await api.getExpenses();
      setExpenses(data);
    } catch (err: any) {
      console.error("Failed to fetch expenses:", err);
      setError(err.message || "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated() || !hasRole("admin")) {
      router.push("/login");
      return;
    }
    fetchExpenses();
  }, [router]);

  const handleApprove = async (id: string) => {
    if (window.confirm(`Are you sure you want to APPROVE expense ${id}?`)) {
      try {
        await api.approveExpense(id);
        alert(`Expense ${id} approved successfully!`);
        fetchExpenses();
      } catch (err: any) {
        console.error("Failed to approve expense:", err);
        alert(
          `Failed to approve expense ${id}: ${err.message || "Unknown error"}`
        );
      }
    }
  };

  const handleReject = async (id: string) => {
    if (window.confirm(`Are you sure you want to REJECT expense ${id}?`)) {
      try {
        await api.rejectExpense(id);
        alert(`Expense ${id} rejected successfully!`);
        fetchExpenses();
      } catch (err: any) {
        console.error("Failed to reject expense:", err);
        alert(
          `Failed to reject expense ${id}: ${err.message || "Unknown error"}`
        );
      }
    }
  };

  const handleFlag = async (id: string) => {
    if (window.confirm(`Are you sure you want to FLAG expense ${id}?`)) {
      try {
        await api.flagExpense(id);
        alert(`Expense ${id} flagged successfully!`);
        fetchExpenses();
      } catch (err: any) {
        console.error("Failed to flag expense:", err);
        alert(
          `Failed to flag expense ${id}: ${err.message || "Unknown error"}`
        );
      }
    }
  };

  if (loading)
    return <div className="container mx-auto p-4">Loading expenses...</div>;
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-600">Error: {error}</div>
    );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Expense Administration</h1>
      {expenses.length === 0 ? (
        <p>No expenses found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-200 text-gray-700">
              <tr>
                <th className="py-2 px-4 text-left">ID</th>
                <th className="py-2 px-4 text-left">User ID</th>
                <th className="py-2 px-4 text-left">Amount</th>
                <th className="py-2 px-4 text-left">Category</th>
                <th className="py-2 px-4 text-left">Vendor</th>
                <th className="py-2 px-4 text-left">Date</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Blockchain Status</th>
                <th className="py-2 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-2 px-4">{expense.id}</td>
                  <td className="py-2 px-4">{expense.user_id}</td>
                  <td className="py-2 px-4">
                    {expense.amount.toFixed(2)} {expense.currency}
                  </td>
                  <td className="py-2 px-4">{expense.category}</td>
                  <td className="py-2 px-4">{expense.vendor_name}</td>
                  <td className="py-2 px-4">
                    {new Date(expense.transaction_date).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-4">{expense.status}</td>
                  <td className="py-2 px-4">
                    {expense.blockchain_status === 0
                      ? "Not Synced"
                      : expense.blockchain_status === 1
                      ? "Synced"
                      : expense.blockchain_status === 2
                      ? "Approved (On-Chain)"
                      : "Failed"}
                  </td>
                  <td className="py-2 px-4 space-x-2">
                    <button
                      onClick={() => handleApprove(expense.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 disabled:opacity-50"
                      disabled={expense.status === "approved"}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(expense.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 disabled:opacity-50"
                      disabled={expense.status === "rejected"}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleFlag(expense.id)}
                      className="bg-yellow-500 text-gray-800 px-3 py-1 rounded-md hover:bg-yellow-600 disabled:opacity-50"
                      disabled={expense.status === "flagged"}
                    >
                      Flag
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
