"use client";

import {useState} from "react";

export default function DashboardPage() {
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-64 border-r border-gray-800 min-h-screen">
          <div className="p-6">
            <div className="text-xl font-bold mb-8">Hulkastorus</div>
            <nav className="space-y-2">
              <a href="/app/dashboard" className="block py-2 px-3 rounded bg-gray-900">
                Dashboard
              </a>
              <a href="/app/browse" className="block py-2 px-3 rounded hover:bg-gray-900">
                File Manager
              </a>
              <a href="/app/settings" className="block py-2 px-3 rounded hover:bg-gray-900">
                Settings
              </a>
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <h1 className="text-3xl font-bold mb-8">Welcome to Hulkastorus</h1>

          <div
            className="border-2 border-dashed border-gray-600 rounded-lg p-16 mb-8 text-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => setShowUploadModal(true)}
          >
            <div className="text-6xl mb-4">📁</div>
            <h2 className="text-xl font-semibold mb-2">Drag files here or click to browse</h2>
            <p className="text-gray-400">Upload files up to 5GB</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Total Files</h3>
              <div className="text-3xl font-bold">0</div>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Storage Used</h3>
              <div className="text-3xl font-bold">0 GB</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Recent Uploads</h3>
              <div className="text-gray-400 text-center py-8">No files uploaded yet</div>
            </div>
            <div className="bg-gray-900 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Storage Breakdown</h3>
              <div className="text-gray-400 text-center py-8">No data to display</div>
            </div>
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
