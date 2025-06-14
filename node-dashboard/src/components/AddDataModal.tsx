import { useState } from "react";
import api from "@/services/api";

interface AddDataModalProps {
  tableName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddDataModal({
  tableName,
  onClose,
  onSuccess,
}: AddDataModalProps) {
  const [formData, setFormData] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const data = JSON.parse(formData);
      await api.createRecord(tableName, data);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError("Failed to add data: " + (e.message || "Invalid JSON format"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Data to {tableName}</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div className="mb-4">
          <label
            htmlFor="jsonData"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            JSON Data
          </label>
          <textarea
            id="jsonData"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            rows={10}
            placeholder='Enter JSON data, e.g., {"name": "New Item", "value": 123}'
            value={formData}
            onChange={(e) => setFormData(e.target.value)}
          ></textarea>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
