import { useEffect, useState } from "react";
import api from "@/services/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableSchema, setTableSchema] = useState<any[]>([]); // To store schema
  const [newRecords, setNewRecords] = useState<any[]>([{}]); // Array to hold new records
  const [editingRecord, setEditingRecord] = useState<any | null>(null); // State to hold the record being edited
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State to control modal visibility
  const [editFormData, setEditFormData] = useState<any>({}); // State to hold form data for the edited record

  const fetchUsersAndSchema = async () => {
    setLoading(true);
    setError("");
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);

      const schema = await api.getTableSchema("users"); // Fetch schema for 'users' table
      setTableSchema(schema);

      const emptyRecord: any = {};
      schema.forEach((col: any) => {
        if (col.name !== "id" && !col.pk) {
          emptyRecord[col.name] = "";
        }
      });
      setNewRecords([emptyRecord]); // Start with one empty row for input
    } catch (e: any) {
      setError("Failed to load users or schema: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndSchema();
  }, []);

  const handleNewRecordChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
    index: number,
    columnName: string
  ) => {
    const { value } = e.target;
    setNewRecords((prevRecords) => {
      const updatedRecords = [...prevRecords];
      updatedRecords[index] = {
        ...updatedRecords[index],
        [columnName]: value,
      };
      return updatedRecords;
    });
  };

  const handleAddRecord = async (recordIndex: number) => {
    setLoading(true);
    setError("");
    try {
      const recordToAdd = newRecords[recordIndex];
      const cleanedRecord = Object.fromEntries(
        tableSchema
          .filter((col: any) => col.name !== "id" && !col.pk)
          .map((col: any) => [col.name, recordToAdd[col.name] || ""])
      );

      // Assuming api.createUser exists or will be added
      await api.createUser(cleanedRecord); // Assuming createUser method in api.ts
      fetchUsersAndSchema(); // Refresh data

      setNewRecords((prevRecords) => {
        const updatedRecords = prevRecords.filter((_, i) => i !== recordIndex);
        if (updatedRecords.length === 0) {
          const emptyRecord: any = {};
          tableSchema.forEach((col: any) => {
            if (col.name !== "id" && !col.pk) {
              emptyRecord[col.name] = "";
            }
          });
          return [emptyRecord];
        }
        return updatedRecords;
      });
    } catch (e: any) {
      setError("Failed to add record: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const addEmptyRecordRow = () => {
    const emptyRecord: any = {};
    tableSchema.forEach((col: any) => {
      if (col.name !== "id" && !col.pk) {
        emptyRecord[col.name] = "";
      }
    });
    setNewRecords((prev) => [...prev, emptyRecord]);
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditFormData({ ...record }); // Initialize form data with current record data
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setEditFormData({});
  };

  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRecord) return;

    setLoading(true);
    setError("");
    try {
      // Assuming api.updateUser exists or will be added, which takes the ID and the updated data
      await api.updateUser(editingRecord.id, editFormData);
      fetchUsersAndSchema(); // Refresh data
      closeEditModal(); // Close the modal after successful save
    } catch (e: any) {
      setError("Failed to save record: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete record with ID: ${recordId}?`
      )
    ) {
      setLoading(true);
      setError("");
      try {
        await api.deleteRecord("users", recordId); // Assuming generic deleteRecord works for 'users'
        fetchUsersAndSchema(); // Refresh data
      } catch (e: any) {
        setError("Failed to delete record: " + (e.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {/* Table for existing users and new record input */}
      {!loading && !error && tableSchema.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg bg-card shadow-sm overflow-x-auto">
          <h2 className="text-xl font-bold mb-3">Table: 'users'</h2>

          <table className="min-w-full divide-y divide-gray-200 border border-border">
            <thead className="bg-muted">
              <tr>
                {tableSchema.map((col: any) => (
                  <th
                    key={col.name}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider"
                  >
                    {col.name}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {/* Existing Data Rows */}
              {users.map((row: any, rowIndex: number) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "bg-background" : "bg-card"}
                >
                  {tableSchema.map((col: any) => (
                    <td
                      key={col.name}
                      className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                    >
                      {row[col.name]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* Actions for existing rows, e.g., Edit, Delete */}
                    <button
                      onClick={() => handleEditRecord(row)}
                      className="text-primary hover:text-primary/80 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(row.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {/* Empty Rows for New Record Input */}
              {newRecords.map((newRecord: any, index: number) => (
                <tr key={`new-record-${index}`} className="bg-muted">
                  {tableSchema.map((col: any) => (
                    <td
                      key={col.name}
                      className="px-6 py-4 whitespace-nowrap text-sm text-foreground"
                    >
                      {col.name !== "id" && !col.pk ? (
                        col.name === "role" ? (
                          <select
                            name={col.name}
                            value={newRecord[col.name] || "user"}
                            onChange={(e) =>
                              handleNewRecordChange(e, index, col.name)
                            }
                            className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-1 bg-background text-foreground"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="vendor">vendor</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            name={col.name}
                            value={newRecord[col.name] || ""}
                            onChange={(e) =>
                              handleNewRecordChange(e, index, col.name)
                            }
                            className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-1 bg-background text-foreground"
                          />
                        )
                      ) : (
                        <span className="text-muted-foreground">
                          Auto-generated
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleAddRecord(index)}
                      className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold py-1 px-3 rounded text-xs mr-2"
                    >
                      Add Row
                    </button>
                    <button
                      onClick={() =>
                        setNewRecords((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="bg-destructive hover:bg-destructive/80 text-destructive-foreground font-bold py-1 px-3 rounded text-xs"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addEmptyRecordRow}
            className="mt-4 bg-primary hover:bg-primary/80 text-primary-foreground font-bold py-2 px-4 rounded"
          >
            Add New Empty Row
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-card p-6 rounded-lg shadow-lg w-1/2">
            <h2 className="text-xl font-bold mb-4">
              Edit Record (ID: {editingRecord.id})
            </h2>
            <form>
              {tableSchema.map((col: any) => {
                // Skip 'id' and primary key columns for editing
                if (col.name === "id" || col.pk) {
                  return null;
                }
                return (
                  <div key={col.name} className="mb-3">
                    <label
                      htmlFor={col.name}
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      {col.name}
                    </label>
                    {col.name === "role" ? (
                      <select
                        name={col.name}
                        id={col.name}
                        value={editFormData[col.name] || ""}
                        onChange={handleEditFormChange}
                        className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="vendor">vendor</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        name={col.name}
                        id={col.name}
                        value={editFormData[col.name] || ""}
                        onChange={handleEditFormChange}
                        className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-2 bg-background text-foreground"
                      />
                    )}
                  </div>
                );
              })}
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
                  onClick={handleSaveEditedRecord}
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
