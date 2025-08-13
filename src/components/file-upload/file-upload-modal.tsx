"use client";

import React, {useState, useRef, useCallback, useEffect} from "react";
import {FileUploadProgress} from "./file-upload-progress";

interface FileWithPath extends File {
  path?: string;
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (fileId: string) => void;
  initialPath?: string;
}

interface UploadState {
  file: FileWithPath | null;
  progress: number;
  status: "idle" | "uploading" | "validating" | "completed" | "error";
  error?: string;
  fileId?: string;
}

export function FileUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  initialPath = "/",
}: FileUploadModalProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: "idle",
  });
  const [permissions, setPermissions] = useState<"public" | "private">("private");
  const [expirationPolicy, setExpirationPolicy] = useState<"infinite" | "1d" | "7d" | "30d">(
    "infinite",
  );
  const [fullPath, setFullPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetModal = useCallback(() => {
    setUploadState({
      file: null,
      progress: 0,
      status: "idle",
    });
    setFullPath("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Reset fullPath when modal opens to a new directory
  useEffect(() => {
    if (isOpen && !fullPath) {
      // Don't auto-set if user has already typed something
    }
  }, [isOpen, initialPath, fullPath]);

  const handleClose = () => {
    if (uploadState.status !== "uploading" && uploadState.status !== "validating") {
      resetModal();
      onClose();
    }
  };

  const handleFileSelect = useCallback(
    (files: FileList | File[]) => {
      const file = files[0] as FileWithPath;
      if (!file) return;

      setUploadState({
        file,
        progress: 0,
        status: "idle",
      });

      // Generate a default path from the file name if none provided
      if (!fullPath) {
        const fileName = file.name;
        const defaultPath = initialPath === "/" ? `/${fileName}` : `${initialPath}/${fileName}`;
        setFullPath(defaultPath);
      }
    },
    [fullPath, initialPath],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      handleFileSelect(files);
    },
    [handleFileSelect],
  );

  const uploadFile = async () => {
    if (!uploadState.file) return;

    setUploadState((prev) => ({...prev, status: "uploading", progress: 0}));

    try {
      // Step 1: Create file record and get upload URL
      const createResponse = await fetch("/api/v1/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: uploadState.file.name,
          mimeType: uploadState.file.type || "application/octet-stream",
          sizeBytes: uploadState.file.size,
          fullPath: fullPath || `/${uploadState.file.name}`,
          permissions,
          expirationPolicy,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create file record");
      }

      const {uploadUrl, id: fileId} = await createResponse.json();

      setUploadState((prev) => ({...prev, fileId, progress: 25}));

      // Step 2: Upload file to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: uploadState.file,
        headers: {
          "Content-Type": uploadState.file.type || "application/octet-stream",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadState((prev) => ({...prev, progress: 75, status: "validating"}));

      // Step 3: Validate upload
      const validateResponse = await fetch(`/api/v1/files/${fileId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "uploaded",
        }),
      });

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json();
        throw new Error(errorData.error || "Failed to validate upload");
      }

      setUploadState((prev) => ({...prev, progress: 100, status: "completed"}));

      // Call completion callback
      if (onUploadComplete && fileId) {
        onUploadComplete(fileId);
      }

      // Auto-close after successful upload
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      setUploadState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Upload failed",
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Upload File</h3>
            <button
              onClick={handleClose}
              disabled={uploadState.status === "uploading" || uploadState.status === "validating"}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✕
            </button>
          </div>

          {/* File Selection Area */}
          {!uploadState.file && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-blue-500 bg-blue-500 bg-opacity-10"
                  : "border-gray-600 hover:border-gray-500"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-4xl mb-4">📁</div>
              <p className="text-lg mb-2">Drop a file here or click to browse</p>
              <p className="text-gray-400 text-sm">Maximum file size: 5GB</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
              />
            </div>
          )}

          {/* File Info and Options */}
          {uploadState.file && (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{uploadState.file.name}</div>
                    <div className="text-sm text-gray-400">
                      {(uploadState.file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                  {uploadState.status === "idle" && (
                    <button
                      onClick={() => {
                        setUploadState({file: null, progress: 0, status: "idle"});
                        setFullPath("");
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {uploadState.status === "idle" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">File Path</label>
                    <input
                      type="text"
                      value={fullPath}
                      onChange={(e) => setFullPath(e.target.value)}
                      placeholder="/path/to/file.ext"
                      className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Organize your files with custom paths. Leave empty to use filename.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Permissions</label>
                    <select
                      value={permissions}
                      onChange={(e) => setPermissions(e.target.value as "public" | "private")}
                      className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
                    >
                      <option value="private">Private - Only you can access</option>
                      <option value="public">Public - Anyone with link can access</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Expiration</label>
                    <select
                      value={expirationPolicy}
                      onChange={(e) =>
                        setExpirationPolicy(e.target.value as "infinite" | "1d" | "7d" | "30d")
                      }
                      className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
                    >
                      <option value="infinite">Never expires</option>
                      <option value="1d">1 day</option>
                      <option value="7d">7 days</option>
                      <option value="30d">30 days</option>
                    </select>
                  </div>
                </>
              )}

              {/* Progress and Status */}
              {(uploadState.status !== "idle" || uploadState.error) && (
                <FileUploadProgress
                  progress={uploadState.progress}
                  status={uploadState.status as "uploading" | "validating" | "completed" | "error"}
                  error={uploadState.error}
                  filename={uploadState.file.name}
                />
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {uploadState.status === "idle" && uploadState.file && (
              <button
                onClick={uploadFile}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
              >
                Start Upload
              </button>
            )}

            {uploadState.status === "completed" && (
              <button
                onClick={handleClose}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded transition-colors"
              >
                Done
              </button>
            )}

            {uploadState.status === "error" && (
              <button
                onClick={() =>
                  setUploadState((prev) => ({...prev, status: "idle", error: undefined}))
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
              >
                Try Again
              </button>
            )}

            <button
              onClick={handleClose}
              disabled={uploadState.status === "uploading" || uploadState.status === "validating"}
              className="flex-1 border border-gray-600 hover:bg-gray-800 py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadState.status === "uploading" || uploadState.status === "validating"
                ? "Uploading..."
                : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
