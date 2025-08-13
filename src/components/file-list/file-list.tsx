"use client";

import React, {useState, useEffect, useCallback} from "react";
import {FileItem} from "./file-item";

interface File {
  id: string;
  filename: string;
  fullPath: string;
  mimeType: string;
  sizeBytes: number;
  permissions: "public" | "private";
  status: string;
  expirationPolicy: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileListResponse {
  files: File[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface FileListProps {
  refreshTrigger?: number;
  onFileSelect?: (file: File) => void;
}

export function FileList({refreshTrigger, onFileSelect}: FileListProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPermissions, setFilterPermissions] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("limit", "50");

      if (filterStatus !== "all") {
        params.append("filter~status", filterStatus);
      }
      if (filterPermissions !== "all") {
        params.append("filter~permissions", filterPermissions);
      }

      params.append("order_by", `${sortBy}+${sortOrder}`);

      const response = await fetch(`/api/v1/files?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data: FileListResponse = await response.json();
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPermissions, sortBy, sortOrder]);

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger, filterStatus, filterPermissions, sortBy, sortOrder, fetchFiles]);

  const filteredFiles = files.filter(
    (file) =>
      file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.fullPath.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Refresh the file list
      fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Files</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span className="ml-2 text-gray-400">Loading files...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Files</h3>
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">Failed to load files</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button
            onClick={fetchFiles}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Files ({filteredFiles.length})</h3>
        <button
          onClick={fetchFiles}
          className="text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="reserved">Reserved</option>
          <option value="validated">Validated</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={filterPermissions}
          onChange={(e) => setFilterPermissions(e.target.value)}
          className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
        >
          <option value="all">All Permissions</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>

        <select
          value={`${sortBy}+${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split("+");
            setSortBy(field);
            setSortOrder(order as "asc" | "desc");
          }}
          className="px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
        >
          <option value="createdAt+desc">Newest First</option>
          <option value="createdAt+asc">Oldest First</option>
          <option value="filename+asc">Name A-Z</option>
          <option value="filename+desc">Name Z-A</option>
          <option value="sizeBytes+desc">Largest First</option>
          <option value="sizeBytes+asc">Smallest First</option>
        </select>
      </div>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            {searchTerm ? "No files match your search" : "No files uploaded yet"}
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onSelect={() => onFileSelect?.(file)}
              onDelete={() => handleDeleteFile(file.id)}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
