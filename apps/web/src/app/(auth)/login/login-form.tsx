"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});

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
          Vantera
        </h2>
        {/* Form */}
        <form action={action} className="flex flex-col w-full gap-4">
          <div className="w-full flex flex-col gap-3">
            {linkExpired && (
              <div className="text-sm text-red-400 text-left">
                That link expired or was already used. Sign in or request a new one.
              </div>
            )}
            <input
              placeholder="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full px-5 py-3 rounded-xl  bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              placeholder="Password"
              type="password"
              name="password"
              autoComplete="current-password"
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
              {pending ? "Signing in…" : "Sign in"}
            </button>
            <div className="w-full text-center mt-2">
              <span className="text-xs text-gray-400">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="underline text-white/80 hover:text-white"
                >
                  Sign up, it&apos;s free!
                </Link>
              </span>
            </div>
            <div className="w-full text-center mt-2">
              <Link
                href="/forgot-password"
                className="text-xs text-gray-400 underline hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
