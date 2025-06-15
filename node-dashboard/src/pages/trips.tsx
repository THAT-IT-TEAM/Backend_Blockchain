import { useEffect, useState } from "react";
import api from "@/services/api";
import { v4 as uuidv4 } from "uuid"; // Import uuid for client-side generation if needed, though backend generates for trips

interface Trip {
  id: string;
  user_id: string;
  name: string;
  description: string;
  budget: number;
  budget_spent: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newTripData, setNewTripData] = useState<Partial<Trip>>({});
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const fetchTrips = async () => {
    setLoading(true);
    setError("");
    try {
      const tripsData = await api.getTrips();
      setTrips(tripsData);
    } catch (e: any) {
      setError("Failed to load trips: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleNewTripChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewTripData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTrip = async () => {
    setLoading(true);
    setError("");
    try {
      // Backend generates UUID for id, so we don't need to generate here
      await api.createTrip({
        ...newTripData,
        budget: parseFloat(newTripData.budget as any), // Ensure budget is a number
        budget_spent: 0, // Default for new trips
        status: newTripData.status || "active", // Default status
        // user_id will typically come from the authenticated user context in a real app
        // For this demo, let's assume a default or get from a placeholder context
        user_id: newTripData.user_id || uuidv4(), // Placeholder, replace with actual user_id from auth context
      });
      fetchTrips();
      closeAddModal();
    } catch (e: any) {
      setError("Failed to add trip: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (trip: Trip) => {
    setEditingTrip(trip);
    setNewTripData(trip); // Populate form with existing trip data
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTrip) return;

    setLoading(true);
    setError("");
    try {
      await api.updateTrip(editingTrip.id, {
        ...newTripData,
        budget: parseFloat(newTripData.budget as any), // Ensure budget is a number
      });
      fetchTrips();
      closeEditModal();
    } catch (e: any) {
      setError("Failed to save trip: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrip = async (id: string) => {
    if (
      window.confirm(`Are you sure you want to delete trip with ID: ${id}?`)
    ) {
      setLoading(true);
      setError("");
      try {
        await api.deleteTrip(id);
        fetchTrips();
      } catch (e: any) {
        setError("Failed to delete trip: " + (e.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    }
  };

  const openAddModal = () => {
    setNewTripData({}); // Clear form
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setNewTripData({});
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTrip(null);
    setNewTripData({});
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Trips</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      <button
        onClick={openAddModal}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mb-4"
      >
        Add New Trip
      </button>

      {!loading && !error && trips.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg bg-card shadow-sm overflow-x-auto">
          <h2 className="text-xl font-bold mb-3">Existing Trips</h2>
          <table className="min-w-full divide-y divide-gray-200 border border-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {trips.map((trip) => (
                <tr key={trip.id} className="bg-background">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.user_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.budget}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.budget_spent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.start_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.end_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {trip.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditClick(trip)}
                      className="text-primary hover:text-primary/80 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTrip(trip.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Trip Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-1/2">
            <h2 className="text-xl font-bold mb-4">Add New Trip</h2>
            <form>
              <div className="mb-3">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={newTripData.name || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Description
                </label>
                <textarea
                  name="description"
                  id="description"
                  value={newTripData.description || ""}
                  onChange={handleNewTripChange}
                  rows={3}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                ></textarea>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="budget"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Budget
                </label>
                <input
                  type="number"
                  name="budget"
                  id="budget"
                  value={newTripData.budget || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  id="startDate"
                  value={newTripData.start_date || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  id="endDate"
                  value={newTripData.end_date || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Status
                </label>
                <select
                  name="status"
                  id="status"
                  value={newTripData.status || "active"}
                  onChange={handleNewTripChange as any}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="userId"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  User ID (for demo, replace with actual auth context)
                </label>
                <input
                  type="text"
                  name="user_id"
                  id="userId"
                  value={newTripData.user_id || ""}
                  onChange={handleNewTripChange}
                  placeholder="e.g., a1b2c3d4-e5f6-7890-1234-567890abcdef"
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="mr-2 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddTrip}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80"
                >
                  Add Trip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Trip Modal */}
      {isEditModalOpen && editingTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-1/2">
            <h2 className="text-xl font-bold mb-4">
              Edit Trip (ID: {editingTrip.id})
            </h2>
            <form>
              <div className="mb-3">
                <label
                  htmlFor="editName"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="editName"
                  value={newTripData.name || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editDescription"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Description
                </label>
                <textarea
                  name="description"
                  id="editDescription"
                  value={newTripData.description || ""}
                  onChange={handleNewTripChange}
                  rows={3}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                ></textarea>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editBudget"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Budget
                </label>
                <input
                  type="number"
                  name="budget"
                  id="editBudget"
                  value={newTripData.budget || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editBudgetSpent"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Budget Spent
                </label>
                <input
                  type="number"
                  name="budget_spent"
                  id="editBudgetSpent"
                  value={newTripData.budget_spent || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                  readOnly // Budget spent is typically updated by expenses, not directly editable here
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editStartDate"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  id="editStartDate"
                  value={newTripData.start_date || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editEndDate"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  id="editEndDate"
                  value={newTripData.end_date || ""}
                  onChange={handleNewTripChange}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editStatus"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Status
                </label>
                <select
                  name="status"
                  id="editStatus"
                  value={newTripData.status || "active"}
                  onChange={handleNewTripChange as any}
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="mb-3">
                <label
                  htmlFor="editUserId"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  User ID (for demo, replace with actual auth context)
                </label>
                <input
                  type="text"
                  name="user_id"
                  id="editUserId"
                  value={newTripData.user_id || ""}
                  onChange={handleNewTripChange}
                  readOnly // user_id is typically not editable after creation
                  className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="mr-2 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
