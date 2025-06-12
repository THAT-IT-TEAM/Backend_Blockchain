import { useEffect, useState } from "react";
import { api } from "@/services/api";

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tableSchema, setTableSchema] = useState<any[]>([]);
  const [newRecords, setNewRecords] = useState<any[]>([{}]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const fetchedBuckets = await api.getBuckets();
        setBuckets(fetchedBuckets);

        if (fetchedBuckets.length > 0 && !selectedBucket) {
          setSelectedBucket(fetchedBuckets[0]);
        }

        if (selectedBucket) {
          const fetchedFiles = await api.getFilesByBucket(selectedBucket);
          setFiles(fetchedFiles);

          const schema = await api.getTableSchema("files");
          setTableSchema(schema);

          const emptyRecord: any = {};
          schema.forEach((col: any) => {
            if (col.name !== "id" && !col.pk) {
              emptyRecord[col.name] = "";
            }
          });
          setNewRecords([emptyRecord]);
        }
      } catch (err: any) {
        console.error("Failed to load files or buckets:", err);
        setError("Failed to load files or buckets: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBucket]);

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
      if (!selectedBucket) {
        setError("Please select a bucket before adding a record.");
        return;
      }

      const recordToAdd = newRecords[recordIndex];
      const cleanedRecord = {
        ...Object.fromEntries(
          tableSchema
            .filter((col: any) => col.name !== "id" && !col.pk)
            .map((col: any) => [col.name, recordToAdd[col.name] || ""])
        ),
        bucket: selectedBucket,
      };

      await api.createFiles(cleanedRecord);
      fetchData();

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
    alert(
      `Edit functionality for file ID: ${record.id} will be implemented here.`
    );
  };

  async function handleDeleteFile(fileId: string) {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        setLoading(true);
        await api.deleteFile(fileId);
        fetchData();
      } catch (err: any) {
        console.error("Failed to delete file:", err);
        setError("Failed to delete file." + err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Files & Storage Buckets</h1>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Select Storage Bucket</h2>
          {buckets.length === 0 ? (
            <p className="text-muted-foreground">No storage buckets found.</p>
          ) : (
            <select
              value={selectedBucket || ""}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="block w-full max-w-xs p-2 border border-border rounded-md bg-background text-foreground shadow-sm focus:ring-primary focus:border-primary"
            >
              <option value="" disabled>
                Select a bucket
              </option>
              {buckets.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selectedBucket && !loading && !error && tableSchema.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg bg-card shadow-sm overflow-x-auto">
          <h2 className="text-xl font-bold mb-3">
            Files in '{selectedBucket}'
          </h2>

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
              {files.map((row: any, rowIndex: number) => (
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
                    {/* Actions for existing rows, e.g., Download, Delete */}
                    {row.id && (
                      <a
                        href={`/api/files/${row.id}`}
                        className="text-primary hover:text-primary/80 underline text-sm mr-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download/View
                      </a>
                    )}
                    <button
                      onClick={() => handleEditRecord(row)}
                      className="text-primary hover:text-primary/80 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteFile(row.id)}
                      className="text-destructive hover:text-destructive/80 text-sm focus:outline-none"
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
                        <input
                          type="text"
                          name={col.name}
                          value={newRecord[col.name] || ""}
                          onChange={(e) =>
                            handleNewRecordChange(e, index, col.name)
                          }
                          className="block w-full border-border rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm p-1 bg-background text-foreground"
                        />
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
    </>
  );
}
