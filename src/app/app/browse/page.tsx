"use client";

import {useState} from "react";

export default function FileManagerPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-64 border-r border-gray-800 min-h-screen">
          <div className="p-6">
            <div className="text-xl font-bold mb-8">Hulkastorus</div>
            <nav className="space-y-2">
              <a href="/app/dashboard" className="block py-2 px-3 rounded hover:bg-gray-900">
                Dashboard
              </a>
              <a href="/app/browse" className="block py-2 px-3 rounded bg-gray-900">
                File Manager
              </a>
              <a href="/app/settings" className="block py-2 px-3 rounded hover:bg-gray-900">
                Settings
              </a>
            </nav>
          </div>
        </aside>

        <main className="flex-1">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-gray-400">
                <span>Home</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
                >
                  Upload
                </button>
                <button className="border border-gray-600 px-4 py-2 rounded hover:bg-gray-800">
                  New Folder
                </button>
              </div>
            </div>
            <div>
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-md px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
              />
            </div>
          </div>

          <div className="flex flex-1">
            <div className="flex-1 p-4">
              <div className="bg-gray-900 rounded-lg">
                <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-800 text-sm font-medium text-gray-400">
                  <div>Name</div>
                  <div>Size</div>
                  <div>Uploaded</div>
                  <div>Expires</div>
                  <div>Permissions</div>
                  <div></div>
                </div>
                <div className="p-8 text-center text-gray-400">
                  <div className="text-6xl mb-4">📁</div>
                  <div>No files in this directory</div>
                  <div className="text-sm mt-2">Drag files here or click upload to get started</div>
                </div>
              </div>
            </div>

            {selectedFile && (
              <aside className="w-80 border-l border-gray-800 p-4">
                <h3 className="text-lg font-semibold mb-4">File Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Name</div>
                    <div>example-file.txt</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Size</div>
                    <div>2.4 MB</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Uploaded</div>
                    <div>2 hours ago</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Permissions</div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">🌐</span>
                      Public
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <button className="w-full bg-white text-black py-2 rounded hover:bg-gray-200">
                    Copy URL
                  </button>
                  <button className="w-full border border-gray-600 py-2 rounded hover:bg-gray-800">
                    Copy as curl
                  </button>
                  <button className="w-full border border-gray-600 py-2 rounded hover:bg-gray-800">
                    Set Expiry
                  </button>
                  <button className="w-full border border-red-600 text-red-400 py-2 rounded hover:bg-red-900/20">
                    Delete
                  </button>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-900 p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Upload File</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">File</label>
                <input
                  type="file"
                  className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Directory</label>
                <input
                  type="text"
                  defaultValue="/"
                  className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Expiration</label>
                <select className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600">
                  <option>Never</option>
                  <option>1 day</option>
                  <option>1 week</option>
                  <option>1 month</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Permissions</label>
                <select className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600">
                  <option>Public</option>
                  <option>Private</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200">
                Upload
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 border border-gray-600 py-2 rounded hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-8 flex justify-center gap-8 text-gray-400">
          <span>© 2024 Hulkastorus</span>
          <a href="/privacy" className="hover:text-white">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white">
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}