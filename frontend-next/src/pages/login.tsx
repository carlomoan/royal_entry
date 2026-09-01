"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { User, Lock, Crown, ShieldCheck, Zap, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";

const schema = z.object({
  login: z.string().min(1, "Username or email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof schema>;

const features = [
  { icon: CalendarDays, title: "Event Management", desc: "Create and manage events end-to-end" },
  { icon: Zap, title: "QR Check-in", desc: "Lightning-fast guest scanning at the door" },
  { icon: ShieldCheck, title: "Secure & Scalable", desc: "Multi-tenant SaaS with role-based access" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  if (isAuthenticated) {
    router.replace("/dashboard");
    return null;
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.login, data.password);
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch {
      toast.error("Invalid username/email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-950 p-12 lg:flex">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(#c9a84c 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-lg shadow-gold-500/30">
            <Crown className="h-6 w-6 text-navy-950" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">RoyalEntry</h1>
            <p className="text-xs text-slate-400">Elite Access Solutions</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-white">
            Elegant guest operations,{" "}
            <span className="text-gold-400">made simple.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            The complete platform for managing events, guests, invitations,
            pledges and payments — built for organizers who demand excellence.
          </p>
          <div className="mt-8 space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 animate-slideIn">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-gold-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} RoyalEntry · All rights reserved
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full items-center justify-center bg-white p-8 lg:w-1/2">
        <div className="w-full max-w-md animate-fadeIn">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600">
              <Crown className="h-6 w-6 text-navy-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-navy-950">RoyalEntry</h1>
              <p className="text-xs text-slate-500">Elite Access Solutions</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to access your dashboard
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            <div className="relative">
              <User className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input
                label="Username or email"
                type="text"
                placeholder="admin or admin@example.com"
                error={errors.login?.message}
                className="pl-10"
                {...register("login")}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                className="pl-10"
                {...register("password")}
              />
            </div>

            <Button type="submit" size="lg" isLoading={isLoading} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} RoyalEntry · Elite Access Solutions
          </p>
        </div>
      </div>
    </div>
  );
}