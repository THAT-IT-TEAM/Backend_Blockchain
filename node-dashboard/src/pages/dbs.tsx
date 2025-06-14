import { useEffect, useState, useRef } from "react";
import api from "@/services/api";
import mermaid from "mermaid";

export default function DatabasesPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<any>({});
  const [relationships, setRelationships] = useState<any>({}); // New state for relationships
  const [diagramContent, setDiagramContent] = useState<string>(""); // New state for Mermaid diagram
  const [allTableSchemas, setAllTableSchemas] = useState<any>({}); // New state to store all table schemas
  const [newRecords, setNewRecords] = useState<any[]>([{}]); // Array to hold new records, starting with one empty.
  const [editingRecord, setEditingRecord] = useState<any | null>(null); // State for the record being edited
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // State to control edit modal visibility

  const mermaidRef = useRef<HTMLDivElement>(null); // Ref for the Mermaid diagram div

  useEffect(() => {
    // Initialize Mermaid globally once
    mermaid.initialize({ startOnLoad: true, theme: "dark" });
  }, []);

  useEffect(() => {
    if (diagramContent) {
      const currentMermaidRef = mermaidRef.current; // Capture the current ref value
      if (currentMermaidRef) {
        // Explicitly check the captured value
        console.log("Mermaid Diagram Content:", diagramContent);
        const renderMermaid = async () => {
          try {
            // Ensure the div is ready and clear previous content
            currentMermaidRef.innerHTML = ""; // Use the captured value
            // Use mermaid.render for more direct control
            const { svg } = await mermaid.render(
              "temp-diagram",
              diagramContent
            );
            currentMermaidRef.innerHTML = svg; // Use the captured value
          } catch (e) {
            console.error("Mermaid rendering error:", e);
            currentMermaidRef.innerHTML =
              '<p class="text-red-500">Failed to render diagram. Check console for details.</p>';
          }
        };
        renderMermaid();
      }
    }
  }, [diagramContent]);

  const fetchTables = async () => {
    setLoading(true);
    setError("");
    try {
      const tablesData = await api.getTables();
      setTables(tablesData);

      const relationshipsData = await api.getDatabaseRelationships();
      setRelationships(relationshipsData);

      const schemas: any = {};
      for (const table of tablesData) {
        const schema = await api.getTableSchema(table);
        schemas[table] = schema;
      }
      setAllTableSchemas(schemas);

      // Generate Mermaid diagram
      let mermaidContent = "classDiagram\n";

      // Add table definitions with columns
      tablesData.forEach((table: string) => {
        mermaidContent += `  class ${table} {\n`;
        const schema = schemas[table];
        if (schema) {
          schema.forEach((col: any) => {
            let columnIndicator = "";
            if (col.pk) {
              columnIndicator = "+ "; // Primary Key
            } else if (
              relationships[table] &&
              relationships[table].some((fk: any) => fk.from === col.name)
            ) {
              columnIndicator = "# "; // Foreign Key
            } else {
              columnIndicator = "~ "; // Regular column
            }
            mermaidContent += `    ${columnIndicator}${col.name}: ${col.type}\n`;
          });
        }
        mermaidContent += `  }\n`;
      });

      // Add auth_users table definition with placeholder columns
      mermaidContent += `  class auth_users {\n`;
      mermaidContent += `    + user_id: VARCHAR (PK)\n`;
      mermaidContent += `    ~ email: VARCHAR\n`;
      mermaidContent += `    ~ password: VARCHAR\n`;
      mermaidContent += `    ~ created_at: DATETIME\n`;
      mermaidContent += `  }\n`;

      // Add Dashboard table definition with placeholder columns
      mermaidContent += `  class Dashboard {\n`;
      mermaidContent += `    + supaid: INT (PK)\n`;
      mermaidContent += `    ~ created_at: timestamptz\n`;
      mermaidContent += `    ~ vendorName: text\n`;
      mermaidContent += `    ~ submittedBy: text\n`;
      mermaidContent += `    ~ projectName: text\n`;
      mermaidContent += `    ~ receiptPreview: text\n`;
      mermaidContent += `    ~ expenseType: text\n`;
      mermaidContent += `    ~ submissionDate: text\n`;
      mermaidContent += `    ~ amount: text\n`;
      mermaidContent += `    ~ status: text\n`;
      mermaidContent += `    ~ onChainHash: text\n`;
      mermaidContent += `    ~ actions: text\n`;
      mermaidContent += `    ~ id: INT\n`;
      mermaidContent += `  }\n`;

      // Add hardcoded relationships to auth_users
      if (tablesData.includes("expenses")) {
        mermaidContent += '  expenses <.. auth_users : "user_id"\n';
      }
      if (tablesData.includes("profiles")) {
        mermaidContent += '  profiles <.. auth_users : "user_id"\n';
      }
      if (tablesData.includes("trips")) {
        mermaidContent += '  trips <.. auth_users : "user_id"\n';
      }

      // Add dynamically fetched relationships
      relationshipsData.forEach((rel: any) => {
        mermaidContent += `  ${rel.from_table} <.. ${rel.to_table} : "${rel.on}"\n`;
      });
      setDiagramContent(mermaidContent);
    } catch (e: any) {
      setError("Failed to load tables or relationships: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableDataAndSchema = async (tableName: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getTableData(tableName);
      setTableData(data);
      const schema = await api.getTableSchema(tableName);
      setTableSchema(schema);

      // Initialize newRecords with one empty row based on schema
      const emptyRecord: any = {};
      schema.forEach((col: any) => {
        if (col.name !== "id" && !col.pk) {
          emptyRecord[col.name] = "";
        }
      });
      setNewRecords([emptyRecord]); // Start with one empty row for input
    } catch (e: any) {
      setError(
        `Failed to load data or schema for table: ${tableName} - ${e.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableDataAndSchema(selectedTable);
    } else {
      setTableData([]);
      setTableSchema([]);
      setNewRecords([{}]); // Clear new records when no table is selected
    }
  }, [selectedTable]);

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
      if (selectedTable) {
        const recordToAdd = newRecords[recordIndex];
        // Filter out empty strings for non-PK/ID columns to avoid sending empty values if not desired
        const cleanedRecord = Object.fromEntries(
          tableSchema
            .filter((col: any) => col.name !== "id" && !col.pk)
            .map((col: any) => [col.name, recordToAdd[col.name] || ""])
        );

        await api.createRecord(selectedTable, cleanedRecord);
        fetchTableDataAndSchema(selectedTable); // Refresh data

        // Remove the added record row and ensure at least one empty row remains
        setNewRecords((prevRecords) => {
          const updatedRecords = prevRecords.filter(
            (_, i) => i !== recordIndex
          );
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
      }
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

  const handleEditRecord = (row: any) => {
    setEditingRecord({ ...row }); // Create a copy to edit
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setError(""); // Clear any previous errors
  };

  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setEditingRecord((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEditedRecord = async () => {
    if (!editingRecord || !selectedTable) return;

    setLoading(true);
    setError("");

    try {
      await api.updateRecord(selectedTable, editingRecord.id, editingRecord);
      fetchTableDataAndSchema(selectedTable); // Refresh data
      closeEditModal();
    } catch (e: any) {
      setError("Failed to update record: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete record with ID: ${recordId}?`
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      if (selectedTable) {
        await api.deleteRecord(selectedTable, recordId);
        fetchTableDataAndSchema(selectedTable); // Refresh data
      }
    } catch (e: any) {
      setError("Failed to delete record: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Database Inspector</h1>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {diagramContent && (
        <div className="mb-4 p-4 border rounded-lg bg-white shadow-sm">
          <h2 className="text-xl font-bold mb-3">Database Schema Overview</h2>
          <div
            ref={mermaidRef}
            className="min-h-[300px] min-w-[500px] flex items-center justify-center border border-dashed border-gray-300"
          >
            {!diagramContent && !loading && !error && <p>Loading diagram...</p>}
            {error && (
              <p className="text-red-500">Error loading diagram: {error}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {!loading &&
          !error &&
          tables.map((table) => (
            <button
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                selectedTable === table
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {table}
            </button>
          ))}
      </div>

      {selectedTable && !loading && !error && tableSchema.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg bg-white shadow-sm overflow-x-auto">
          <h2 className="text-xl font-bold mb-3">Table: '{selectedTable}'</h2>

          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                {tableSchema.map((col: any) => (
                  <th
                    key={col.name}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.name}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Existing Data Rows */}
              {tableData.map((row: any, rowIndex: number) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {tableSchema.map((col: any) => (
                    <td
                      key={col.name}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {row[col.name]}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* Actions for existing rows, e.g., Edit, Delete */}
                    <button
                      onClick={() => handleEditRecord(row)}
                      className="text-blue-600 hover:text-blue-900 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(row.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {/* Empty Rows for New Record Input */}
              {newRecords.map((newRecord: any, index: number) => (
                <tr key={`new-record-${index}`} className="bg-gray-100">
                  {tableSchema.map((col: any) => (
                    <td
                      key={col.name}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {col.name !== "id" && !col.pk ? (
                        <input
                          type="text"
                          name={col.name}
                          value={newRecord[col.name] || ""}
                          onChange={(e) =>
                            handleNewRecordChange(e, index, col.name)
                          }
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-1"
                        />
                      ) : (
                        <span className="text-gray-500">Auto-generated</span>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleAddRecord(index)}
                      className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-xs mr-2"
                    >
                      Add Row
                    </button>
                    <button
                      onClick={() =>
                        setNewRecords((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-xs"
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
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Add New Empty Row
          </button>
        </div>
      )}

      {/* Edit Record Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="relative p-5 border w-11/12 md:max-w-md lg:max-w-2xl xl:max-w-4xl bg-white rounded-md shadow-xl">
            <h3 className="text-xl font-bold mb-4">
              Edit Record for {selectedTable}
            </h3>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            <form className="space-y-4">
              {tableSchema.map((col: any) => (
                <div key={col.name}>
                  <label
                    htmlFor={`edit-${col.name}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {col.name}
                  </label>
                  {col.name === "id" || col.pk ? (
                    <input
                      type="text"
                      id={`edit-${col.name}`}
                      name={col.name}
                      value={editingRecord[col.name] || ""}
                      disabled
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm bg-gray-100 cursor-not-allowed"
                    />
                  ) : (
                    <input
                      type="text"
                      id={`edit-${col.name}`}
                      name={col.name}
                      value={editingRecord[col.name] || ""}
                      onChange={handleEditFormChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  )}
                </div>
              ))}
            </form>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedRecord}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
