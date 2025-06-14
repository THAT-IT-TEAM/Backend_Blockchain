import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/router";
import { isAuthenticated, hasRole } from "@/services/auth";

interface Trip {
  id: string;
  name: string;
  description: string;
  budget: number;
  budget_spent: number;
  start_date: string;
  end_date: string;
  status: string;
  user_id: string; // The creator of the trip
}

interface ProjectMember {
  user_id: number;
  project_role: string;
  user_email: string;
  wallet_id: string;
}

interface Expense {
  id: string;
  amount: number;
  currency: string;
  transaction_date: string;
  vendor_name: string;
  category: string;
  description: string;
  document_url: string;
  status: string;
}

export default function ProjectTeamsTestPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [selectedMemberExpenses, setSelectedMemberExpenses] = useState<
    Expense[]
  >([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<
    { id: number; email: string; role: string }[]
  >([]);
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("member");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated() || !hasRole("admin")) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const fetchedTrips = await api.getTables("trips"); // Assuming getTables can fetch trips
        setTrips(fetchedTrips);

        const fetchedUsers = await api.getUsers(); // Assuming getUsers fetches all users
        setAllUsers(fetchedUsers);
      } catch (err: any) {
        console.error("Failed to fetch initial data:", err);
        setError(err.message || "Failed to load initial data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (selectedTripId) {
        try {
          const members = await api.getProjectMembers(selectedTripId);
          setProjectMembers(members);
          setSelectedMemberExpenses([]); // Clear expenses when trip changes
          setSelectedMemberId(null);
        } catch (err: any) {
          console.error("Failed to fetch project members:", err);
          setError(err.message || "Failed to load project members.");
        }
      }
    };
    fetchProjectData();
  }, [selectedTripId]);

  const handleViewMemberExpenses = async (memberUserId: string) => {
    if (selectedTripId && memberUserId) {
      try {
        const expenses = await api.getTeamMemberExpenses(
          selectedTripId,
          memberUserId
        );
        setSelectedMemberExpenses(expenses);
        setSelectedMemberId(memberUserId);
      } catch (err: any) {
        console.error(
          `Failed to fetch expenses for member ${memberUserId}:`,
          err
        );
        alert(`Failed to load expenses: ${err.message || "Unknown error"}`);
      }
    }
  };

  const handleAddMember = async () => {
    if (!selectedTripId || !newMemberUserId) {
      alert("Please select a project and a user to add.");
      return;
    }
    try {
      await api.createRecord("project_members", {
        project_id: selectedTripId,
        user_id: parseInt(newMemberUserId),
        role: newMemberRole,
      });
      alert(
        `User ${newMemberUserId} added to project ${selectedTripId} as ${newMemberRole}.`
      );
      // Refresh members list
      const members = await api.getProjectMembers(selectedTripId);
      setProjectMembers(members);
      setNewMemberUserId("");
    } catch (err: any) {
      console.error("Failed to add member:", err);
      alert(`Failed to add member: ${err.message || "Unknown error"}`);
    }
  };

  const handleRemoveMember = async (memberUserId: number) => {
    if (!selectedTripId || !memberUserId) {
      alert("Missing project or user ID.");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to remove user ${memberUserId} from this project?`
      )
    ) {
      try {
        // Assuming project_members can be deleted by project_id and user_id,
        // but API only supports ID. Need to fetch project_member ID first.
        const members = await api.getProjectMembers(selectedTripId);
        const memberToDelete = members.find((m) => m.user_id === memberUserId);

        if (memberToDelete) {
          // In a real scenario, the backend would need a specific endpoint for composite key deletion
          // or we'd rely on the frontend to know the `project_members` table ID.
          // For now, if generic deleteRecord works with `id`, we need that ID.
          // If `project_members` table primary key is `id`, we need to get it.
          // Let's assume the backend handleCrud for project_members uses `id` as primary key.
          // If the backend `handleCrud` doesn't support deleting by composite key (project_id, user_id)
          // we would need a specific backend endpoint for that.
          // For this test, let's assume the `project_members` table returns its own `id` if fetched.
          // As a fallback, we'll try to delete by a dummy ID if real ID is not immediately available.

          // This part is tricky. The current `handleCrud` DELETE expects a single ID.
          // We need to either:
          // 1. Modify backend `handleCrud` to support deleting by composite key (project_id, user_id)
          // 2. Add a specific backend endpoint like DELETE /api/trips/:tripId/members/:userId
          // 3. Ensure the project_members fetching returns the `id` of the join table entry.

          // Assuming for now, getProjectMembers returns the primary key 'id' for project_members table
          // Let's refine the interface if 'id' is available from project_members table.

          // Re-fetching project members to get their `id` from the join table
          const allProjectRecords = await api.getTableData("project_members");
          const recordToDelete = allProjectRecords.find(
            (record) =>
              record.project_id === selectedTripId &&
              record.user_id === memberUserId
          );

          if (recordToDelete && recordToDelete.id) {
            await api.deleteRecord("project_members", recordToDelete.id);
            alert(
              `User ${memberUserId} removed from project ${selectedTripId}.`
            );
            // Refresh members list
            const updatedMembers = await api.getProjectMembers(selectedTripId);
            setProjectMembers(updatedMembers);
            setSelectedMemberExpenses([]);
            setSelectedMemberId(null);
          } else {
            alert("Could not find the project member record to delete.");
          }
        } else {
          alert("Project member not found.");
        }
      } catch (err: any) {
        console.error("Failed to remove member:", err);
        alert(`Failed to remove member: ${err.message || "Unknown error"}`);
      }
    }
  };

  if (loading)
    return (
      <div className="container mx-auto p-4">Loading project team data...</div>
    );
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-600">Error: {error}</div>
    );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Project Teams Management</h1>

      <div className="mb-4">
        <label
          htmlFor="select-trip"
          className="block text-sm font-medium text-gray-700"
        >
          Select Project:
        </label>
        <select
          id="select-trip"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={selectedTripId || ""}
          onChange={(e) => setSelectedTripId(e.target.value)}
        >
          <option value="">-- Select a Project --</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name} (ID: {trip.id})
            </option>
          ))}
        </select>
      </div>

      {selectedTripId && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">
            Members of Project:{" "}
            {trips.find((t) => t.id === selectedTripId)?.name}
          </h2>
          {projectMembers.length === 0 ? (
            <p>No members assigned to this project.</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
                <thead className="bg-gray-200 text-gray-700">
                  <tr>
                    <th className="py-2 px-4 text-left">User ID</th>
                    <th className="py-2 px-4 text-left">Email</th>
                    <th className="py-2 px-4 text-left">Role in Project</th>
                    <th className="py-2 px-4 text-left">Wallet ID</th>
                    <th className="py-2 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectMembers.map((member) => (
                    <tr
                      key={member.user_id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="py-2 px-4">{member.user_id}</td>
                      <td className="py-2 px-4">{member.user_email}</td>
                      <td className="py-2 px-4">{member.project_role}</td>
                      <td className="py-2 px-4">{member.wallet_id}</td>
                      <td className="py-2 px-4 space-x-2">
                        <button
                          onClick={() =>
                            handleViewMemberExpenses(member.user_id.toString())
                          }
                          className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600"
                        >
                          View Expenses
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="text-lg font-semibold mb-2">Add Member to Project</h3>
          <div className="flex items-center space-x-2 mb-4">
            <select
              className="mt-1 block w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={newMemberUserId}
              onChange={(e) => setNewMemberUserId(e.target.value)}
            >
              <option value="">-- Select User --</option>
              {allUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} (ID: {user.id})
                </option>
              ))}
            </select>
            <select
              className="mt-1 block w-1/4 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
            >
              <option value="member">Member</option>
              <option value="lead">Lead</option>
            </select>
            <button
              onClick={handleAddMember}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Add Member
            </button>
          </div>

          {selectedMemberId && selectedMemberExpenses.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">
                Expenses for{" "}
                {
                  allUsers.find((u) => u.id.toString() === selectedMemberId)
                    ?.email
                }{" "}
                in Project {trips.find((t) => t.id === selectedTripId)?.name}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
                  <thead className="bg-gray-200 text-gray-700">
                    <tr>
                      <th className="py-2 px-4 text-left">ID</th>
                      <th className="py-2 px-4 text-left">Date</th>
                      <th className="py-2 px-4 text-left">Amount</th>
                      <th className="py-2 px-4 text-left">Category</th>
                      <th className="py-2 px-4 text-left">Description</th>
                      <th className="py-2 px-4 text-left">Status</th>
                      <th className="py-2 px-4 text-left">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMemberExpenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="py-2 px-4">{expense.id}</td>
                        <td className="py-2 px-4">
                          {new Date(
                            expense.transaction_date
                          ).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-4">
                          {expense.amount.toFixed(2)} {expense.currency}
                        </td>
                        <td className="py-2 px-4">{expense.category}</td>
                        <td className="py-2 px-4">{expense.description}</td>
                        <td className="py-2 px-4">{expense.status}</td>
                        <td className="py-2 px-4">
                          {expense.document_url && (
                            <a
                              href={expense.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              View
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
