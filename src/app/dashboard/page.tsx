import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import Link from "next/link";
import type {Session} from "next-auth";

export default async function DashboardPage() {
  const session = (await auth()) as Session | null;

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link
            href="/logout"
            className="px-4 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-colors"
          >
            Logout
          </Link>
        </div>

        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome back!</h2>
          <p className="text-gray-400 mb-2">You are logged in as:</p>
          <p className="text-lg">{session?.user?.email}</p>
          {session?.user?.name && <p className="text-gray-300 mt-2">Name: {session.user.name}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Files</h3>
            <p className="text-gray-400">0 files uploaded</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Storage</h3>
            <p className="text-gray-400">0 MB used</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">API Keys</h3>
            <p className="text-gray-400">0 active keys</p>
          </div>
        </div>
      </div>
    </div>
  );
}
