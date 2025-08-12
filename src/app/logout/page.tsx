"use client";

import {useEffect} from "react";
import {signOut} from "next-auth/react";

export default function LogoutPage() {
  useEffect(() => {
    signOut({
      callbackUrl: "/login",
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-bold mb-4">Logging out...</div>
        <div className="text-gray-400">You will be redirected to the login page</div>
      </div>
    </div>
  );
}
