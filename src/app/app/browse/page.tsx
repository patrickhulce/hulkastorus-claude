"use client";

import {FileBrowser} from "@/components/file-browser/file-browser";

export default function FileManagerPage() {
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
          <FileBrowser />
        </main>
      </div>

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
