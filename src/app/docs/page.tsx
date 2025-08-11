import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Hulkastorus
        </Link>
        <div className="flex gap-6 items-center">
          <Link href="/docs" className="hover:text-gray-300">
            Docs
          </Link>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#pricing" className="hover:text-gray-300">
            Pricing
          </a>
          <Link href="/login" className="hover:text-gray-300">
            Login
          </Link>
          <a
            href="mailto:invites@hulkastor.us"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200"
          >
            Request Invite
          </a>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 border-r border-gray-800 min-h-screen p-6">
          <nav className="space-y-2">
            <a href="#getting-started" className="block py-2 px-3 rounded hover:bg-gray-900">
              Getting Started
            </a>
            <a href="#api-reference" className="block py-2 px-3 rounded hover:bg-gray-900">
              API Reference
            </a>
            <a href="#faq" className="block py-2 px-3 rounded hover:bg-gray-900">
              FAQ
            </a>
          </nav>
        </aside>

        <main className="flex-1 max-w-3xl mx-auto p-8">
          <h1 className="text-4xl font-bold mb-8">Documentation</h1>

          <section id="getting-started" className="mb-16">
            <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
            <p className="text-gray-300 mb-4">
              Welcome to Hulkastorus! Get up and running in minutes with our simple file storage
              service.
            </p>
            <div className="bg-gray-900 p-4 rounded-lg mb-4">
              <code className="text-green-400">npm install @hulkastorus/client</code>
            </div>
          </section>

          <section id="api-reference" className="mb-16">
            <h2 className="text-2xl font-semibold mb-4">API Reference</h2>
            <p className="text-gray-300 mb-4">
              Our REST API provides two simple endpoints for uploading and downloading files.
            </p>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Upload File</h3>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <code className="text-green-400">POST /api/files</code>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Download File</h3>
                <div className="bg-gray-900 p-4 rounded-lg">
                  <code className="text-green-400">GET /files/:id</code>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" className="mb-16">
            <h2 className="text-2xl font-semibold mb-4">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">What file sizes are supported?</h3>
                <p className="text-gray-300">We support files up to 5GB in size.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">How long are files stored?</h3>
                <p className="text-gray-300">
                  Files are stored indefinitely by default, but you can set custom expiration times.
                </p>
              </div>
            </div>
          </section>
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
