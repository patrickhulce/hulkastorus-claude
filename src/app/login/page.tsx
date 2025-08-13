"use client";

import {useState, useEffect, Suspense} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {signIn} from "next-auth/react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      setSuccess("Registration successful! Please login with your credentials.");
    }
    if (searchParams.get("error")) {
      setError("Invalid email or password");
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (showForgotPassword) {
      setLoading(true);
      setTimeout(() => {
        setSuccess("If an account exists with this email, a reset link has been sent.");
        setShowForgotPassword(false);
        setLoading(false);
      }, 1000);
      return;
    }

    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/app/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 rounded-lg p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold mb-2">Hulkastorus</div>
            <div className="text-gray-400">Welcome back</div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-md text-red-200 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded-md text-green-200 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>

            {!showForgotPassword && (
              <div>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-gray-800 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-3 rounded-md hover:bg-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : showForgotPassword ? "Send Reset Link" : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <button
              onClick={() => setShowForgotPassword(!showForgotPassword)}
              className="text-gray-400 hover:text-white text-sm"
            >
              {showForgotPassword ? "Back to login" : "Forgot password?"}
            </button>
            {!showForgotPassword && (
              <div>
                <Link href="/register" className="text-gray-400 hover:text-white text-sm">
                  Don&apos;t have an account? Register
                </Link>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-400 text-sm space-x-4">
          <span>© 2024 Hulkastorus</span>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
