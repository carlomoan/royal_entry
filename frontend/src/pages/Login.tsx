// ==============================================================================
// FILE: src/pages/Login.tsx
// ==============================================================================

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Crown, User, Lock } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const schema = z.object({
  login: z.string().min(1, "Username or email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof schema>;

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.login, data.password);
      toast.success("Welcome back!");
    } catch {
      toast.error("Invalid username/email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#c9a84c 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                          bg-gold-500 mb-4 shadow-lg shadow-gold-500/30"
          >
            <Crown className="w-8 h-8 text-navy-900" />
          </div>
          <h1 className="text-3xl font-bold text-white">RoyalEntry</h1>
          <p className="text-gold-400 mt-1 text-sm">Elite Access Solutions</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in</h2>
          <p className="text-gray-500 text-sm mb-6">
            Access your organizer dashboard
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-9 w-4 h-4 text-gray-400" />
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
              <Lock className="absolute left-3 top-9 w-4 h-4 text-gray-400" />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                className="pl-10"
                {...register("password")}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © {new Date().getFullYear()} RoyalEntry · Elite Access Solutions
        </p>
      </div>
    </div>
  );
}
