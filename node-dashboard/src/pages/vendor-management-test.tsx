import { useState, useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/router";
import { isAuthenticated, hasRole } from "@/services/auth";

interface Profile {
  id: string;
  user_id: string;
  wallet_id: string;
  email: string;
  role: string;
  status: string; // 'unverified', 'verified', etc.
}

export default function VendorManagementTestPage() {
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchVendors = async () => {
    try {
      setLoading(true);
      // Assuming profiles can be filtered by role 'vendor' or we fetch all profiles and filter here.
      // For now, let's fetch all profiles and filter client-side.
      // In a real application, a dedicated backend endpoint for fetching vendors would be more efficient.
      const allProfiles = await api.getTableData("profiles");
      const vendorProfiles = allProfiles.filter(
        (profile: Profile) => profile.role === "vendor"
      );
      setVendors(vendorProfiles);
    } catch (err: any) {
      console.error("Failed to fetch vendor profiles:", err);
      setError(err.message || "Failed to load vendor profiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated() || !hasRole("admin")) {
      router.push("/login");
      return;
    }
    fetchVendors();
  }, [router]);

  const handleUpdateStatus = async (vendorId: string, newStatus: string) => {
    if (
      window.confirm(
        `Are you sure you want to change status of vendor ${vendorId} to ${newStatus}?`
      )
    ) {
      try {
        await api.updateVendorStatus(vendorId, newStatus);
        alert(`Vendor ${vendorId} status updated to ${newStatus}.`);
        fetchVendors(); // Refresh the list
      } catch (err: any) {
        console.error("Failed to update vendor status:", err);
        alert(
          `Failed to update vendor status: ${err.message || "Unknown error"}`
        );
      }
    }
  };

  if (loading)
    return <div className="container mx-auto p-4">Loading vendor data...</div>;
  if (error)
    return (
      <div className="container mx-auto p-4 text-red-600">Error: {error}</div>
    );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Vendor Management</h1>

      {vendors.length === 0 ? (
        <p>No vendor profiles found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-200 text-gray-700">
              <tr>
                <th className="py-2 px-4 text-left">Profile ID</th>
                <th className="py-2 px-4 text-left">User ID</th>
                <th className="py-2 px-4 text-left">Email</th>
                <th className="py-2 px-4 text-left">Wallet ID</th>
                <th className="py-2 px-4 text-left">Current Status</th>
                <th className="py-2 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="py-2 px-4">{vendor.id}</td>
                  <td className="py-2 px-4">{vendor.user_id}</td>
                  <td className="py-2 px-4">{vendor.email}</td>
                  <td className="py-2 px-4">{vendor.wallet_id}</td>
                  <td className="py-2 px-4">{vendor.status}</td>
                  <td className="py-2 px-4 space-x-2">
                    <button
                      onClick={() => handleUpdateStatus(vendor.id, "verified")}
                      className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 disabled:opacity-50"
                      disabled={vendor.status === "verified"}
                    >
                      Mark Verified
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateStatus(vendor.id, "unverified")
                      }
                      className="bg-yellow-500 text-gray-800 px-3 py-1 rounded-md hover:bg-yellow-600 disabled:opacity-50"
                      disabled={vendor.status === "unverified"}
                    >
                      Mark Unverified
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
