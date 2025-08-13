"use client";

import React, {useState, useEffect, useCallback} from "react";
import {DirectoryTree} from "../directory-tree/directory-tree";
import {Breadcrumb} from "../breadcrumb/breadcrumb";
import {FileUploadModal} from "../file-upload/file-upload-modal";
import {DirectoryModal} from "../directory-modal/directory-modal";

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


interface FileBrowserProps {
  initialPath?: string;
}

export function FileBrowser({initialPath = "/"}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [directoryModalParent, setDirectoryModalParent] = useState("/");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentDirectoryFiles, setCurrentDirectoryFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectoryFiles = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("limit", "100");
      params.append("filter~fullPath", `${path}*`);
      params.append("order_by", "filename+asc");

      const response = await fetch(`/api/v1/files?${params}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      
      // Filter files to only show those directly in the current directory
      const directFiles = data.files.filter((file: File) => {
        const filePath = file.fullPath;
        const relativePath = filePath.startsWith(path) ? filePath.slice(path.length) : filePath;
        
        // Remove leading slash if path is not root
        const cleanRelativePath = relativePath.startsWith("/") && path !== "/" 
          ? relativePath.slice(1) 
          : relativePath;
        
        // Only show files directly in this directory (no subdirectories)
        return !cleanRelativePath.includes("/") && cleanRelativePath.length > 0;
      });
      
      setCurrentDirectoryFiles(directFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
      setCurrentDirectoryFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectoryFiles(currentPath);
  }, [currentPath, refreshTrigger, fetchDirectoryFiles]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const handleCreateDirectory = async (name: string, parentPath: string, permissions: "public" | "private" | "inherit") => {
    const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    
    const response = await fetch("/api/v1/directories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        fullPath,
        permissions,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create directory");
    }

    // Refresh the directory tree and file list
    setRefreshTrigger(prev => prev + 1);
  };

  const handleShowCreateDirectory = (parentPath: string) => {
    setDirectoryModalParent(parentPath);
    setShowDirectoryModal(true);
  };

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
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

  return (
    <div className="flex h-full">
      {/* Directory Tree Sidebar */}
      <div className="w-64 border-r border-gray-800 bg-gray-900">
        <DirectoryTree
          currentPath={currentPath}
          onNavigate={handleNavigate}
          onCreateDirectory={handleShowCreateDirectory}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Breadcrumb and Actions */}
        <div className="border-b border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <Breadcrumb currentPath={currentPath} onNavigate={handleNavigate} />
            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
              >
                📄 Upload File
              </button>
              <button
                onClick={() => handleShowCreateDirectory(currentPath)}
                className="border border-gray-600 hover:bg-gray-800 px-4 py-2 rounded transition-colors"
              >
                📁 New Folder
              </button>
            </div>
          </div>
        </div>

        {/* File List Area */}
        <div className="flex-1 p-4">
          <div className="bg-gray-900 rounded-lg h-full">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Files in {currentPath === "/" ? "Home" : currentPath} ({currentDirectoryFiles.length})
                </h3>
                <button
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Refresh"
                >
                  ↻
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                  <span className="ml-2 text-gray-400">Loading files...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-400 mb-2">Failed to load files</div>
                  <div className="text-gray-400 text-sm mb-4">{error}</div>
                  <button
                    onClick={() => fetchDirectoryFiles(currentPath)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : currentDirectoryFiles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📁</div>
                  <div className="text-gray-400 mb-2">No files in this directory</div>
                  <div className="text-sm text-gray-500">Upload files or create subdirectories to get started</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentDirectoryFiles.map(file => (
                    <div
                      key={file.id}
                      className={`bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer ${
                        selectedFile?.id === file.id ? "ring-2 ring-blue-500" : ""
                      }`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-2xl flex-shrink-0">
                            {file.mimeType.startsWith("image/") ? "🖼️" :
                             file.mimeType.startsWith("video/") ? "🎥" :
                             file.mimeType.startsWith("audio/") ? "🎵" :
                             file.mimeType.includes("pdf") ? "📄" :
                             file.mimeType.includes("text") ? "📝" :
                             file.mimeType.includes("zip") || file.mimeType.includes("archive") ? "📦" :
                             "📁"}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-white truncate">
                                {file.filename}
                              </h4>
                              <span className={`px-2 py-1 rounded text-xs ${
                                file.status === "validated" ? "bg-green-900 text-green-300" :
                                file.status === "reserved" ? "bg-yellow-900 text-yellow-300" :
                                file.status === "failed" ? "bg-red-900 text-red-300" :
                                "bg-gray-900 text-gray-300"
                              }`}>
                                {file.status === "validated" ? "✓ Validated" :
                                 file.status === "reserved" ? "⏳ Reserved" :
                                 file.status === "failed" ? "✗ Failed" :
                                 file.status}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                file.permissions === "public" 
                                  ? "bg-blue-900 text-blue-300" 
                                  : "bg-gray-700 text-gray-300"
                              }`}>
                                {file.permissions === "public" ? "🌐 Public" : "🔒 Private"}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-400">
                              <div className="flex items-center gap-4">
                                <span>{formatFileSize(file.sizeBytes)}</span>
                                <span>{formatDate(file.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Details Sidebar */}
      {selectedFile && (
        <div className="w-80 border-l border-gray-800 p-4 bg-gray-900">
          <h3 className="text-lg font-semibold mb-4">File Details</h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">Name</div>
              <div className="break-words">{selectedFile.filename}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Full Path</div>
              <div className="break-words text-sm">{selectedFile.fullPath}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Size</div>
              <div>{formatFileSize(selectedFile.sizeBytes)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Uploaded</div>
              <div>{formatDate(selectedFile.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Status</div>
              <div className={`inline-flex items-center gap-2 ${
                selectedFile.status === "validated" ? "text-green-400" :
                selectedFile.status === "reserved" ? "text-yellow-400" :
                selectedFile.status === "failed" ? "text-red-400" :
                "text-gray-400"
              }`}>
                {selectedFile.status === "validated" ? "✓" :
                 selectedFile.status === "reserved" ? "⏳" :
                 selectedFile.status === "failed" ? "✗" :
                 "●"}
                {selectedFile.status}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Permissions</div>
              <div className="flex items-center gap-2">
                <span className={selectedFile.permissions === "public" ? "text-blue-400" : "text-gray-400"}>
                  {selectedFile.permissions === "public" ? "🌐" : "🔒"}
                </span>
                {selectedFile.permissions === "public" ? "Public" : "Private"}
              </div>
            </div>
          </div>
          
          <div className="mt-6 space-y-2">
            {selectedFile.status === "validated" && (
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/v1/files/${selectedFile.id}/download`);
                    if (response.status === 307) {
                      const downloadUrl = response.headers.get("Location");
                      if (downloadUrl) {
                        window.open(downloadUrl, "_blank");
                      }
                    }
                  } catch {
                    alert("Failed to download file");
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors"
              >
                ⬇️ Download
              </button>
            )}
            
            <button
              onClick={async () => {
                try {
                  const baseUrl = window.location.origin;
                  const link = selectedFile.permissions === "public" 
                    ? `${baseUrl}/d/${selectedFile.id}`
                    : `${baseUrl}/api/v1/files/${selectedFile.id}/download`;
                  
                  await navigator.clipboard.writeText(link);
                  alert("Link copied to clipboard!");
                } catch {
                  alert("Failed to copy link");
                }
              }}
              className="w-full border border-gray-600 hover:bg-gray-800 py-2 rounded transition-colors"
            >
              🔗 Copy Link
            </button>
            
            <button
              onClick={async () => {
                if (!confirm("Are you sure you want to delete this file?")) {
                  return;
                }
                
                try {
                  const response = await fetch(`/api/v1/files/${selectedFile.id}`, {
                    method: "DELETE",
                  });
                  
                  if (!response.ok) {
                    throw new Error("Failed to delete file");
                  }
                  
                  setSelectedFile(null);
                  setRefreshTrigger(prev => prev + 1);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to delete file");
                }
              }}
              className="w-full border border-red-600 text-red-400 hover:bg-red-900/20 py-2 rounded transition-colors"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
        initialPath={currentPath}
      />
      
      <DirectoryModal
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        onCreateDirectory={handleCreateDirectory}
        parentPath={directoryModalParent}
      />
    </div>
  );
}