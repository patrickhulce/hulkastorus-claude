export default function SettingsPage() {
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
              <a href="/app/browse" className="block py-2 px-3 rounded hover:bg-gray-900">
                File Manager
              </a>
              <a href="/app/settings" className="block py-2 px-3 rounded bg-gray-900">
                Settings
              </a>
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-8">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="max-w-2xl space-y-8">
            <section className="border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">Display Name</label>
                  <input
                    type="text"
                    defaultValue="John Doe"
                    className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue="john@example.com"
                    disabled
                    className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 opacity-50 cursor-not-allowed"
                  />
                </div>
                <button className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200">
                  Save Changes
                </button>
              </div>
            </section>

            <section className="border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Password</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2">Current Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">New Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700 focus:border-gray-600"
                  />
                </div>
                <button className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200">
                  Update Password
                </button>
              </div>
            </section>

            <section className="border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">API Keys</h2>
              <div className="space-y-4">
                <div className="bg-gray-900 rounded-lg">
                  <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-800 text-sm font-medium text-gray-400">
                    <div>Name</div>
                    <div>Key</div>
                    <div>Created</div>
                    <div></div>
                  </div>
                  <div className="p-4 text-center text-gray-400">No API keys created yet</div>
                </div>
                <button className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200">
                  Generate New Key
                </button>
              </div>
            </section>

            <section className="border border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-red-400">Danger Zone</h2>
              <div className="space-y-4">
                <p className="text-gray-400">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
                  Delete Account
                </button>
              </div>
            </section>
          </div>
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
