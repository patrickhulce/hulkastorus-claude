"use client";

import React, {useState} from "react";

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

interface FileItemProps {
  file: File;
  onSelect?: () => void;
  onDelete?: () => void;
  formatFileSize: (bytes: number) => string;
  formatDate: (date: string) => string;
}

export function FileItem({file, onSelect, onDelete, formatFileSize, formatDate}: FileItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [copying, setCopying] = useState(false);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎥";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("text")) return "📝";
    if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
    return "📁";
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      validated: {color: "bg-green-900 text-green-300", label: "✓ Validated"},
      reserved: {color: "bg-yellow-900 text-yellow-300", label: "⏳ Reserved"},
      failed: {color: "bg-red-900 text-red-300", label: "✗ Failed"},
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-900 text-gray-300",
      label: status,
    };

    return <span className={`px-2 py-1 rounded text-xs ${config.color}`}>{config.label}</span>;
  };

  const getExpirationInfo = () => {
    if (file.expirationPolicy === "infinite") {
      return "Never expires";
    }

    if (file.expiresAt) {
      const expiresDate = new Date(file.expiresAt);
      const now = new Date();
      const isExpired = expiresDate < now;

      return (
        <span className={isExpired ? "text-red-400" : "text-yellow-400"}>
          {isExpired ? "Expired" : `Expires ${formatDate(file.expiresAt)}`}
        </span>
      );
    }

    return `Expires in ${file.expirationPolicy}`;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/v1/files/${file.id}/download`);

      if (response.status === 307) {
        // Follow redirect to actual download URL
        const downloadUrl = response.headers.get("Location");
        if (downloadUrl) {
          window.open(downloadUrl, "_blank");
        }
      } else {
        throw new Error("Failed to get download URL");
      }
    } catch {
      alert("Failed to download file");
    }
  };

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      const baseUrl = window.location.origin;
      const link =
        file.permissions === "public"
          ? `${baseUrl}/d/${file.id}`
          : `${baseUrl}/api/v1/files/${file.id}/download`;

      await navigator.clipboard.writeText(link);

      // Show feedback
      setTimeout(() => setCopying(false), 1000);
    } catch {
      setCopying(false);
      alert("Failed to copy link");
    }
  };

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer group"
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-2xl flex-shrink-0">{getFileIcon(file.mimeType)}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-white truncate">{file.filename}</h4>
              {getStatusBadge(file.status)}
              <span
                className={`px-2 py-1 rounded text-xs ${
                  file.permissions === "public"
                    ? "bg-blue-900 text-blue-300"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                {file.permissions === "public" ? "🌐 Public" : "🔒 Private"}
              </span>
            </div>

            <div className="text-sm text-gray-400">
              <div className="flex items-center gap-4">
                <span>{file.fullPath}</span>
                <span>{formatFileSize(file.sizeBytes)}</span>
                <span>{formatDate(file.createdAt)}</span>
              </div>
              <div className="mt-1">{getExpirationInfo()}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {(showActions || showActions) && (
          <div className="flex items-center gap-2 ml-4">
            {file.status === "validated" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors"
                title="Download"
              >
                ⬇️
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyLink();
              }}
              className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
              title={copying ? "Copied!" : "Copy link"}
            >
              {copying ? "✓" : "🔗"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
