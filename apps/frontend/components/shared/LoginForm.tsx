"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLogin } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/apiClient";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      const next = searchParams.get("next") ?? "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-text-secondary">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="you@hplmaker.demo"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium text-text-secondary">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-sm bg-critical-tint px-3 py-2 text-xs text-critical" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={login.isPending}>
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
