"use client";

import React, {useState} from "react";

interface DirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateDirectory: (
    name: string,
    parentPath: string,
    permissions: "public" | "private" | "inherit",
  ) => Promise<void>;
  parentPath: string;
}

export function DirectoryModal({
  isOpen,
  onClose,
  onCreateDirectory,
  parentPath,
}: DirectoryModalProps) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<"public" | "private" | "inherit">("inherit");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Directory name is required");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name.trim())) {
      setError("Directory name can only contain letters, numbers, dots, hyphens, and underscores");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await onCreateDirectory(name.trim(), parentPath, permissions);
      setName("");
      setPermissions("inherit");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create directory");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) {
      setName("");
      setPermissions("inherit");
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Create New Directory</h3>
            <button
              onClick={handleClose}
              disabled={creating}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Directory Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="my-directory"
                className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
                disabled={creating}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Letters, numbers, dots, hyphens, and underscores only
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Parent Directory</label>
              <div className="px-3 py-2 bg-gray-800 rounded border border-gray-700 text-gray-300">
                {parentPath}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Full Path</label>
              <div className="px-3 py-2 bg-gray-800 rounded border border-gray-700 text-gray-300">
                {fullPath}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Permissions</label>
              <select
                value={permissions}
                onChange={(e) => setPermissions(e.target.value as "public" | "private" | "inherit")}
                className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600 focus:outline-none"
                disabled={creating}
              >
                <option value="inherit">Inherit from parent</option>
                <option value="private">Private - Only you can access</option>
                <option value="public">Public - Anyone with link can access</option>
              </select>
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
              >
                {creating ? "Creating..." : "Create Directory"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={creating}
                className="flex-1 border border-gray-600 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
