"use client";

import {useState} from "react";
import {useSession, signOut} from "next-auth/react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {FileUploadModal} from "@/components/file-upload/file-upload-modal";
import {FileList} from "@/components/file-list/file-list";
import {DashboardStats} from "@/components/dashboard/dashboard-stats";

export default function DashboardPage() {
  const {data: session, status} = useSession();
  const router = useRouter();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleLogout = async () => {
    await signOut({callbackUrl: "/login"});
  };

  const handleUploadComplete = (fileId: string) => {
    console.log("Upload completed for file:", fileId);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      setShowUploadModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        <aside className="w-64 border-r border-gray-800 min-h-screen">
          <div className="p-6">
            <div className="text-xl font-bold mb-4">Hulkastorus</div>

            {/* User info */}
            <div className="mb-6 p-3 bg-gray-900 rounded-lg">
              <div className="text-sm text-gray-400">Logged in as:</div>
              <div className="text-sm font-medium">{session?.user?.email}</div>
              {session?.user?.name && (
                <div className="text-xs text-gray-400">{session.user.name}</div>
              )}
            </div>

            <nav className="space-y-2 mb-6">
              <Link href="/app/dashboard" className="block py-2 px-3 rounded bg-gray-900">
                Dashboard
              </Link>
              <Link href="/app/browse" className="block py-2 px-3 rounded hover:bg-gray-900">
                File Manager
              </Link>
              <Link href="/app/settings" className="block py-2 px-3 rounded hover:bg-gray-900">
                Settings
              </Link>
            </nav>

            <button
              onClick={handleLogout}
              className="w-full py-2 px-3 text-left rounded hover:bg-gray-900 text-gray-400 hover:text-white"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              + Upload File
            </button>
          </div>

          {/* Quick Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 mb-8 text-center cursor-pointer transition-colors bg-gray-900 bg-opacity-50 ${
              isDragOver
                ? "border-blue-500 bg-blue-500 bg-opacity-10"
                : "border-gray-600 hover:border-gray-500"
            }`}
            onClick={() => setShowUploadModal(true)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-5xl mb-4">📁</div>
            <h2 className="text-xl font-semibold mb-2">
              {isDragOver ? "Drop files to upload" : "Drop files here or click to upload"}
            </h2>
            <p className="text-gray-400">Support for files up to 5GB</p>
          </div>

          {/* Dashboard Stats */}
          <DashboardStats refreshTrigger={refreshTrigger} />

          {/* File List */}
          <FileList refreshTrigger={refreshTrigger} />
        </main>
      </div>

      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />

      <footer className="border-t border-gray-800 py-8">
        <div className="container mx-auto px-8 flex justify-center gap-8 text-gray-400">
          <span>© 2024 Hulkastorus</span>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
