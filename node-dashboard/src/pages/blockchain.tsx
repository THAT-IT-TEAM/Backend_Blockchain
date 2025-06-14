import { useEffect, useState } from "react";
import api from "@/services/api";

export default function BlockchainPage() {
  const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchBlockchainInfo = async () => {
      try {
        setLoading(true);
        const data = await api.getBlockchainInfo();
        setBlockchainInfo(data);
      } catch (err: any) {
        console.error("Failed to fetch blockchain info:", err);
        setError("Failed to load blockchain information: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchBlockchainInfo();
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">Blockchain Information</h1>
      {loading && <div>Loading blockchain information...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {!loading && !error && blockchainInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Node Details</h2>
            <p>
              <strong>Node Name:</strong> {blockchainInfo.nodeName}
            </p>
            <p>
              <strong>Node Version:</strong> {blockchainInfo.nodeVersion}
            </p>
            <p>
              <strong>RPC URL:</strong> {blockchainInfo.rpcUrl}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Network Status</h2>
            <p>
              <strong>Network ID:</strong> {blockchainInfo.networkId}
            </p>
            <p>
              <strong>Peer Count:</strong> {blockchainInfo.peerCount}
            </p>
            <p>
              <strong>Is Mining:</strong>{" "}
              {blockchainInfo.isMining ? "Yes" : "No"}
            </p>
            <p>
              <strong>Is Syncing:</strong>{" "}
              {blockchainInfo.isSyncing ? "Yes" : "No"}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Block Data</h2>
            <p>
              <strong>Current Block Number:</strong>{" "}
              {blockchainInfo.blockNumber}
            </p>
            <p>
              <strong>Gas Price:</strong> {blockchainInfo.gasPrice} wei
            </p>
            <p>
              <strong>Chain ID:</strong> {blockchainInfo.chainId}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-card shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Accounts</h2>
            <p>
              <strong>Default Account:</strong>{" "}
              {blockchainInfo.defaultAccount || "N/A"}
            </p>
            <div>
              <strong>Accounts:</strong>
              <ul className="list-disc list-inside ml-2">
                {blockchainInfo.accounts &&
                blockchainInfo.accounts.length > 0 ? (
                  blockchainInfo.accounts.map((account: string) => (
                    <li key={account}>{account}</li>
                  ))
                ) : (
                  <li>No accounts found.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
