import { useEffect, useState, useRef } from "react";
import api from "@/services/api";

export default function FilesPage() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newBucketName, setNewBucketName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Use the same backend base as API calls
  const backendBase =
    process.env.NEXT_PUBLIC_API_BASE ||
    "https://good-polecat-enormously.ngrok-free.app";

  useEffect(() => {
    fetchBuckets();
  }, []);

  async function fetchBuckets() {
    setLoading(true);
    setError("");
    try {
      const fetchedBuckets = await api.getBuckets();
      setBuckets(fetchedBuckets);
    } catch (err: any) {
      setError("Failed to load buckets: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectBucket(bucket: string) {
    setSelectedBucket(bucket);
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const fetchedFiles = await api.getFilesByBucket(bucket);
      setFiles(fetchedFiles);
    } catch (err: any) {
      setError("Failed to load files: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBucket(bucket: string) {
    if (!window.confirm(`Delete bucket '${bucket}' and all its files?`)) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.deleteBucket(bucket);
      setBuckets((prev) => prev.filter((b) => b !== bucket));
      if (selectedBucket === bucket) setSelectedBucket(null);
      setSuccess(`Bucket '${bucket}' deleted.`);
    } catch (err: any) {
      setError("Failed to delete bucket: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUploadClick(bucket: string) {
    setSelectedBucket(bucket);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !selectedBucket) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const file = e.target.files[0];
      await api.uploadFileToBucket(file, selectedBucket);
      setSuccess("File uploaded!");
      if (selectedBucket) handleSelectBucket(selectedBucket);
    } catch (err: any) {
      setError("Failed to upload file: " + err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCreateBucket(e: React.FormEvent) {
    e.preventDefault();
    if (!newBucketName.trim()) {
      setError("Bucket name cannot be empty.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.createBucket(newBucketName.trim());
      setSuccess(`Bucket '${newBucketName.trim()}' created.`);
      setNewBucketName("");
      fetchBuckets();
    } catch (err: any) {
      setError("Failed to create bucket: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleGetFileLink(fileUrl: string) {
    navigator.clipboard.writeText(window.location.origin + fileUrl);
    setSuccess("File link copied to clipboard!");
  }

  async function handleDeleteFile(fileCid: string) {
    if (!window.confirm("Delete this file?")) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.deleteFile(fileCid);
      setSuccess("File deleted.");
      if (selectedBucket) handleSelectBucket(selectedBucket);
    } catch (err: any) {
      setError("Failed to delete file: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Storage Buckets</h1>
      <form
        onSubmit={handleCreateBucket}
        className="flex items-center gap-2 mb-8"
      >
        <input
          type="text"
          placeholder="New bucket name"
          value={newBucketName}
          onChange={(e) => setNewBucketName(e.target.value)}
          className="border border-border rounded-md px-3 py-2 focus:ring-primary focus:border-primary bg-background text-foreground"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 rounded font-semibold"
        >
          Create Bucket
        </button>
      </form>
      {loading && <div className="mb-4">Loading...</div>}
      {error && <div className="mb-4 text-red-500 font-semibold">{error}</div>}
      {success && (
        <div className="mb-4 text-green-600 font-semibold">{success}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {buckets.length === 0 && (
          <div className="col-span-2 text-muted-foreground">
            No buckets found.
          </div>
        )}
        {buckets.map((bucket) => (
          <div
            key={bucket}
            className="rounded-lg border border-border bg-card shadow p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg">{bucket}</span>
              <button
                onClick={() => handleDeleteBucket(bucket)}
                className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm font-semibold"
              >
                Delete
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleUploadClick(bucket)}
                className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm font-semibold"
              >
                Upload
              </button>
              <button
                onClick={() => handleSelectBucket(bucket)}
                className={`bg-card px-3 py-1 rounded text-sm font-semibold border ${
                  selectedBucket === bucket ? "border-primary" : "border-border"
                }`}
              >
                View Files
              </button>
            </div>
          </div>
        ))}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      {selectedBucket && (
        <div className="mb-4 p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-2xl font-bold mb-3">
            Files in '{selectedBucket}'
          </h2>
          {files.length === 0 ? (
            <div className="text-muted-foreground">
              No files in this bucket.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 border border-border mt-2">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {files.map((file: any) => {
                  // Parse bucket from metadata
                  let bucket = selectedBucket;
                  if (file.metadata) {
                    try {
                      const meta =
                        typeof file.metadata === "string"
                          ? JSON.parse(file.metadata)
                          : file.metadata;
                      if (meta.bucket) bucket = meta.bucket;
                    } catch {}
                  }
                  const fileUrl = `${backendBase}/uploads/${bucket}/${file.name}`;
                  return (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {file.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {file.size}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2 justify-end">
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline mr-2"
                        >
                          Download/View
                        </a>
                        <button
                          onClick={() => handleGetFileLink(fileUrl)}
                          className="bg-muted px-2 py-1 rounded text-xs font-semibold"
                        >
                          Get Link
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="bg-destructive text-destructive-foreground px-2 py-1 rounded text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
