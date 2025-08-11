export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
        <div className="text-xl font-bold">Hulkastorus</div>
        <div className="flex gap-6 items-center">
          <a href="/docs" className="hover:text-gray-300">
            Docs
          </a>
          <a href="#pricing" className="hover:text-gray-300">
            Pricing
          </a>
          <a href="/login" className="hover:text-gray-300">
            Login
          </a>
          <a
            href="mailto:invites@hulkastor.us"
            className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200"
          >
            Request Invite
          </a>
        </div>
      </nav>

      <div className="container mx-auto px-8">
        <section className="flex flex-col items-center justify-center h-[40vh] text-center">
          <h1 className="text-5xl font-bold mb-4">Hulkastorus</h1>
          <p className="text-xl text-gray-300 mb-8">
            Simple file storage and sharing without the overhead
          </p>
          <div className="flex gap-4">
            <a
              href="mailto:invites@hulkastor.us"
              className="bg-white text-black px-6 py-3 rounded-md hover:bg-gray-200"
            >
              Request Invite
            </a>
            <a href="/docs" className="border border-white px-6 py-3 rounded-md hover:bg-gray-900">
              Read the Docs
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-8 py-16">
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">No Complexity</h3>
            <p className="text-gray-400">
              Drag, drop, and get a link. No buckets, regions, or complex SDKs to configure.
            </p>
          </div>
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Developer Friendly</h3>
            <p className="text-gray-400">
              Simple REST API with two endpoints. Perfect for CI/CD pipelines and automation.
            </p>
          </div>
          <div className="p-6 border border-gray-800 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">Fast & Reliable</h3>
            <p className="text-gray-400">
              Powered by Cloudflare R2 for global performance and reliability.
            </p>
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Simple API</h2>
          <div className="bg-gray-900 p-6 rounded-lg">
            <pre className="text-green-400">
              <code>{`# Upload a file
curl -X POST https://api.hulkastor.us/files \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@database.sqlite"

# Download a file  
curl https://hulkastor.us/files/abc123`}</code>
            </pre>
          </div>
        </section>

        <section className="py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Trusted By</h2>
          <div className="flex justify-center gap-12 opacity-50">
            <div className="text-2xl">Hooli</div>
            <div className="text-2xl">Pied Piper</div>
            <div className="text-2xl">Enron</div>
            <div className="text-2xl">Theranos</div>
          </div>
        </section>

        <section id="pricing" className="py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Pricing</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Free</h3>
              <p className="text-3xl font-bold mb-4">$0</p>
              <p className="text-gray-400">Free during beta</p>
            </div>
            <div className="border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Pro</h3>
              <p className="text-3xl font-bold mb-4">$0</p>
              <p className="text-gray-400">Free during beta</p>
            </div>
            <div className="border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Tres Commas</h3>
              <p className="text-3xl font-bold mb-4">$0</p>
              <p className="text-gray-400">Free during beta</p>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-gray-800 py-8 mt-16">
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
