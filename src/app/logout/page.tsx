"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }

    const timer = setTimeout(() => {
      router.push("/login");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-bold mb-4">Logging out...</div>
        <div className="text-gray-400">You will be redirected to the login page</div>
      </div>
    </div>
  );
}
