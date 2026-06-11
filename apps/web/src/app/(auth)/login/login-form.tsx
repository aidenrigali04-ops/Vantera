"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type AuthFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          {linkExpired && (
            <FormError message="That link expired or was already used. Sign in or request a new one." />
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <FormError message={state.error} />
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <div className="flex justify-between text-sm text-muted-foreground">
            <Link className="hover:underline" href="/forgot-password">
              Forgot password?
            </Link>
            <Link className="hover:underline" href="/signup">
              Create account
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
