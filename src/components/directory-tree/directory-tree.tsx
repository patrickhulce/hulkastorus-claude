"use client";

import React, {useState, useEffect, useCallback} from "react";

interface Directory {
  id: string;
  name: string;
  fullPath: string;
  permissions: "public" | "private" | "inherit";
  createdAt: string;
  updatedAt: string;
  children?: Directory[];
}

interface DirectoryTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onCreateDirectory?: (parentPath: string) => void;
}

export function DirectoryTree({currentPath, onNavigate, onCreateDirectory}: DirectoryTreeProps) {
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{path: string; x: number; y: number} | null>(null);

  const fetchDirectories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/v1/directories");
      if (!response.ok) {
        throw new Error("Failed to fetch directories");
      }

      const data = await response.json();
      setDirectories(data.directories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load directories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDirectories();
  }, [fetchDirectories]);

  useEffect(() => {
    // Auto-expand directories in the current path
    const pathParts = currentPath.split("/").filter(Boolean);
    const newExpanded = new Set(expandedPaths);

    let buildPath = "";
    pathParts.forEach((part) => {
      buildPath += "/" + part;
      newExpanded.add(buildPath);
    });

    setExpandedPaths(newExpanded);
  }, [currentPath, expandedPaths]);

  const buildDirectoryTree = (dirs: Directory[]): Directory[] => {
    const pathMap = new Map<string, Directory>();
    const rootDirs: Directory[] = [];

    // Create a map of all directories
    dirs.forEach((dir) => {
      pathMap.set(dir.fullPath, {...dir, children: []});
    });

    // Build the tree structure
    dirs.forEach((dir) => {
      const parentPath = dir.fullPath.substring(0, dir.fullPath.lastIndexOf("/")) || "/";
      const parent = pathMap.get(parentPath);

      if (parent && parent.fullPath !== dir.fullPath) {
        parent.children!.push(pathMap.get(dir.fullPath)!);
      } else if (parentPath === "/") {
        rootDirs.push(pathMap.get(dir.fullPath)!);
      }
    });

    return rootDirs.sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({path, x: e.clientX, y: e.clientY});
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleCreateDirectory = () => {
    if (contextMenu) {
      onCreateDirectory?.(contextMenu.path);
    }
    closeContextMenu();
  };

  const renderDirectoryItem = (dir: Directory, level: number = 0) => {
    const isExpanded = expandedPaths.has(dir.fullPath);
    const isCurrent = dir.fullPath === currentPath;
    const hasChildren = dir.children && dir.children.length > 0;

    return (
      <div key={dir.fullPath}>
        <div
          className={`flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-gray-800 rounded ${
            isCurrent ? "bg-blue-900 text-blue-300" : ""
          }`}
          style={{paddingLeft: `${(level + 1) * 12}px`}}
          onClick={() => onNavigate(dir.fullPath)}
          onContextMenu={(e) => handleContextMenu(e, dir.fullPath)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(dir.fullPath);
              }}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <span className="text-lg">📁</span>
          <span className="text-sm truncate flex-1">{dir.name}</span>

          {dir.permissions === "public" && <span className="text-xs text-blue-400">🌐</span>}
        </div>

        {hasChildren && isExpanded && (
          <div>{dir.children!.map((child) => renderDirectoryItem(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const directoryTree = buildDirectoryTree(directories);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span>Loading directories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-400 text-sm mb-2">Failed to load directories</div>
        <button onClick={fetchDirectories} className="text-blue-400 hover:text-blue-300 text-sm">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Directories</h3>
          <button
            onClick={fetchDirectories}
            className="text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>

        {/* Root directory */}
        <div
          className={`flex items-center gap-2 py-1 px-2 cursor-pointer hover:bg-gray-800 rounded ${
            currentPath === "/" ? "bg-blue-900 text-blue-300" : ""
          }`}
          onClick={() => onNavigate("/")}
          onContextMenu={(e) => handleContextMenu(e, "/")}
        >
          <span className="text-lg">🏠</span>
          <span className="text-sm">Home</span>
        </div>

        {/* Directory tree */}
        <div className="mt-2">{directoryTree.map((dir) => renderDirectoryItem(dir))}</div>

        {directoryTree.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-sm">No directories found</div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded shadow-lg py-1"
          style={{left: contextMenu.x, top: contextMenu.y}}
        >
          <button
            onClick={handleCreateDirectory}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
          >
            📁 New Folder
          </button>
        </div>
      )}
    </div>
  );
}
