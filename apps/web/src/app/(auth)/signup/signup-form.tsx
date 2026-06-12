"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthFormState } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});

  if (state.sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212] relative overflow-hidden w-full rounded-xl">
        <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm  shadow-2xl p-8 flex flex-col items-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 mb-6 shadow-lg">
            <span className="text-xl font-semibold text-white">V</span>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            Check your email
          </h2>
          <p className="text-sm text-gray-300 text-center">
            We sent a confirmation link to your inbox. Click it to continue setting up
            your workspace.
          </p>
          <div className="w-full text-center mt-6">
            <span className="text-xs text-gray-400">
              Already confirmed?{" "}
              <Link href="/login" className="underline text-white/80 hover:text-white">
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212] relative overflow-hidden w-full rounded-xl">
      {/* Centered glass card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm  shadow-2xl p-8 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 mb-6 shadow-lg">
          <span className="text-xl font-semibold text-white">V</span>
        </div>
        {/* Title */}
        <h2 className="text-2xl font-semibold text-white mb-6 text-center">
          Create your account
        </h2>
        {/* Form */}
        <form action={action} className="flex flex-col w-full gap-4">
          <div className="w-full flex flex-col gap-3">
            <input
              placeholder="Name"
              type="text"
              name="companyName"
              autoComplete="organization"
              required
              className="w-full px-5 py-3 rounded-xl  bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              placeholder="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full px-5 py-3 rounded-xl  bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              placeholder="Password (at least 8 characters)"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full px-5 py-3 rounded-xl  bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            {state.error && (
              <div className="text-sm text-red-400 text-left">{state.error}</div>
            )}
          </div>
          <hr className="opacity-10" />
          <div>
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-white/10 text-white font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition mb-3  text-sm disabled:opacity-60"
            >
              {pending ? "Creating account…" : "Create account"}
            </button>
            <div className="w-full text-center mt-2">
              <span className="text-xs text-gray-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="underline text-white/80 hover:text-white"
                >
                  Sign in
                </Link>
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
