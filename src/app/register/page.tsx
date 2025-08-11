export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 rounded-lg p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold mb-2">Hulkastorus</div>
            <div className="text-gray-400">Create your account</div>
          </div>

          <form className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Invite Code"
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-white text-black py-3 rounded-md hover:bg-gray-200 font-medium"
            >
              Register
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/login" className="text-gray-400 hover:text-white text-sm">
              Already have an account? Login
            </a>
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-400 text-sm space-x-4">
          <span>© 2024 Hulkastorus</span>
          <a href="/privacy" className="hover:text-white">
            Privacy
          </a>
          <a href="/terms" className="hover:text-white">
            Terms
          </a>
        </footer>
      </div>
    </div>
  );
}