"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #003087 0%, #00205B 40%, #001A4D 70%, #000F33 100%)" }}
    >
      {/* Subtle animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #C8102E 0%, transparent 70%)", animation: "pulse 6s ease-in-out infinite" }} />
        <div className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #003087 0%, transparent 70%)", animation: "pulse 8s ease-in-out infinite 2s" }} />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", animation: "pulse 7s ease-in-out infinite 1s" }} />
      </div>

      {/* Logo with entrance animation */}
      <div 
        className="relative z-10 mb-8 transition-all duration-1000 ease-out"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0) scale(1)" : "translateY(-30px) scale(0.9)",
        }}
      >
        <div className="relative h-32 w-44 mx-auto drop-shadow-2xl" style={{ filter: "drop-shadow(0 0 30px rgba(200, 16, 46, 0.3))" }}>
          <Image src="/logo.png" alt="Hampton by Hilton Logo" fill sizes="176px" className="object-contain" priority />
        </div>
      </div>

      {/* Login Card with staggered entrance */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 transition-all duration-1000 ease-out"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(30px)",
          transitionDelay: "300ms",
        }}
      >
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 
              className="text-2xl font-bold text-white tracking-tight transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transitionDelay: "500ms" }}
            >
              Welcome Back
            </h1>
            <p 
              className="text-sm text-white/60 mt-1 transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transitionDelay: "600ms" }}
            >
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div 
              className="space-y-2 transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-20px)", transitionDelay: "700ms" }}
            >
              <Label htmlFor="email" className="text-white/80 text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 focus-visible:border-white/40 h-11 rounded-lg backdrop-blur-sm"
              />
            </div>
            <div 
              className="space-y-2 transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-20px)", transitionDelay: "800ms" }}
            >
              <Label htmlFor="password" className="text-white/80 text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/40 focus-visible:border-white/40 h-11 rounded-lg backdrop-blur-sm"
              />
            </div>

            {/* Remember Me */}
            <div
              className="flex items-center gap-3 transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transitionDelay: "850ms" }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                className="relative h-5 w-5 rounded-md border transition-all duration-200 flex items-center justify-center flex-shrink-0"
                style={{
                  borderColor: rememberMe ? "rgba(200, 16, 46, 0.8)" : "rgba(255,255,255,0.3)",
                  background: rememberMe ? "linear-gradient(135deg, #C8102E 0%, #A00D24 100%)" : "rgba(255,255,255,0.08)",
                  boxShadow: rememberMe ? "0 2px 8px rgba(200, 16, 46, 0.35)" : "none",
                }}
              >
                {rememberMe && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <label 
                className="text-sm text-white/70 cursor-pointer select-none"
                onClick={() => setRememberMe(!rememberMe)}
              >
                Remember me for 30 days
              </label>
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}
            <div
              className="transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transitionDelay: "900ms" }}
            >
              <Button 
                className="w-full h-11 rounded-lg font-semibold text-sm tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]" 
                type="submit" 
                disabled={loading}
                style={{ background: "linear-gradient(135deg, #C8102E 0%, #A00D24 100%)", boxShadow: "0 4px 15px rgba(200, 16, 46, 0.4)" }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom branding */}
      <p 
        className="relative z-10 mt-8 text-xs text-white/30 tracking-widest uppercase transition-all duration-1000"
        style={{ opacity: mounted ? 1 : 0, transitionDelay: "1200ms" }}
      >
        Manassas • (703) 369-1100
      </p>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.08; }
          50% { transform: scale(1.15); opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
