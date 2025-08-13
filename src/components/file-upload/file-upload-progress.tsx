"use client";

import React from "react";

interface FileUploadProgressProps {
  progress: number;
  status: "uploading" | "validating" | "completed" | "error";
  error?: string;
  filename: string;
}

export function FileUploadProgress({progress, status, error, filename}: FileUploadProgressProps) {
  const getStatusText = () => {
    switch (status) {
      case "uploading":
        return "Uploading to storage...";
      case "validating":
        return "Validating upload...";
      case "completed":
        return "Upload completed successfully!";
      case "error":
        return `Upload failed: ${error}`;
      default:
        return "";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "uploading":
      case "validating":
        return "text-blue-400";
      case "completed":
        return "text-green-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case "uploading":
      case "validating":
        return "bg-blue-600";
      case "completed":
        return "bg-green-600";
      case "error":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium truncate">{filename}</span>
        <span className="text-sm text-gray-400">{progress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
          style={{width: `${progress}%`}}
        />
      </div>

      {/* Status Text */}
      <div className={`text-sm ${getStatusColor()}`}>
        <div className="flex items-center gap-2">
          {(status === "uploading" || status === "validating") && (
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
          )}
          {status === "completed" && <span className="text-green-400">✓</span>}
          {status === "error" && <span className="text-red-400">✗</span>}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Error Details */}
      {status === "error" && error && (
        <div className="mt-2 p-2 bg-red-900 bg-opacity-20 border border-red-800 rounded text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
