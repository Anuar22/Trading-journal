import React, { useState } from "react";
import { Flame, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthGate() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setError("");
    setMessage("");
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage("Account created. Check your email if confirmation is enabled, then sign in.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a12] p-4 text-white">
      <Card className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1220] text-white shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Flame className="h-3.5 w-3.5" />
            TradeZellah Cloud Sync
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === "login" ? "Sign in to your journal" : "Create your journal account"}
          </CardTitle>
          <p className="text-sm text-slate-400">
            Use your Gmail account or email and password to sync your trades across devices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full rounded-2xl border-white/15 bg-white text-slate-950 hover:bg-slate-100"
          >
            {googleLoading ? "Redirecting to Google..." : "Continue with Gmail (Google)"}
          </Button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/10" />
            <span className="mx-3 text-xs uppercase text-slate-500">or</span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-200">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@gmail.com"
                  className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-200">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                {message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              disabled={loading || googleLoading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="pt-1 text-center text-xs text-slate-400">
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
                className="underline hover:text-white"
              >
                Don&apos;t have an account? Sign up
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
                className="underline hover:text-white"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}