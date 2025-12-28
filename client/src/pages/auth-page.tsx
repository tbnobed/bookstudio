import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { insertUserSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import logoPath from "../assets/logo.png";
import logoDarkPath from "../assets/logo-dark.png";
import { ArrowLeft, Loader2 } from "lucide-react";
import promoVideo from "@assets/bookstudioPromo_1766899495039.mp4";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const { data: siteNameData } = useQuery<{ siteName: string }>({
    queryKey: ['/api/system/site-name'],
  });

  const loginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
  });
  
  const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
  });

  const registerSchema = insertUserSchema
    .pick({
      username: true,
      password: true,
      name: true,
      email: true,
    })
    .extend({
      confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      name: "",
      email: "",
    },
  });
  
  const forgotPasswordForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const { loginMutation, registerMutation, user } = useAuth();
  
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    console.log("Login form submitted with data:", data);
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: z.infer<typeof registerSchema>) => {
    const { confirmPassword, ...registerData } = data;
    const userData = { ...registerData, role: "producer" };
    
    console.log("Register form submitted with data:", userData);
    registerMutation.mutate(userData);
  };

  const onForgotPasswordSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
    try {
      setForgotPasswordLoading(true);
      
      const origin = window.location.origin;
      console.log("Current origin:", origin);
      
      const response = await apiRequest("POST", "/api/forgot-password", {
        ...data,
        origin
      });
      
      const result = await response.json();
      
      if (result.success) {
        setForgotPasswordSuccess(true);
        toast({
          title: "Password reset email sent",
          description: "If an account exists with that email, you will receive a password reset link.",
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "An error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#003366] dark:bg-gray-950 p-4 relative overflow-hidden">
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(50px, -80px) scale(1.1); }
          50% { transform: translate(-30px, -120px) scale(0.9); }
          75% { transform: translate(-60px, -40px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-80px, 60px) scale(1.15); }
          50% { transform: translate(40px, 100px) scale(0.85); }
          75% { transform: translate(70px, 30px) scale(1.1); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(100px, -60px) scale(1.2); }
          66% { transform: translate(-50px, 80px) scale(0.8); }
        }
        @keyframes float4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-40px, -100px) scale(1.1); }
          40% { transform: translate(60px, -50px) scale(0.95); }
          60% { transform: translate(30px, 70px) scale(1.15); }
          80% { transform: translate(-70px, 40px) scale(0.9); }
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          mix-blend-mode: screen;
        }
      `}</style>
      
      <div className="orb w-96 h-96 bg-blue-500/40 top-[-10%] left-[-10%]" style={{ animation: 'float1 20s ease-in-out infinite' }} />
      <div className="orb w-80 h-80 bg-cyan-400/30 bottom-[-5%] right-[-5%]" style={{ animation: 'float2 25s ease-in-out infinite' }} />
      <div className="orb w-72 h-72 bg-indigo-500/35 top-[20%] right-[10%]" style={{ animation: 'float3 18s ease-in-out infinite' }} />
      <div className="orb w-64 h-64 bg-purple-500/25 bottom-[20%] left-[15%]" style={{ animation: 'float4 22s ease-in-out infinite' }} />
      
      <div className="absolute top-6 left-6 z-20">
        <img src={logoPath} alt="BookStud.io" className="h-64 w-auto dark:hidden drop-shadow-xl" />
        <img src={logoDarkPath} alt="BookStud.io" className="h-64 w-auto hidden dark:block drop-shadow-xl" />
      </div>
      
      <div className="w-full max-w-6xl relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-12 px-4">
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="flex flex-col items-center mb-6">
            {siteNameData?.siteName && (
              <h1 className="text-4xl lg:text-5xl font-bold text-white text-center drop-shadow-xl tracking-tight">
                {siteNameData.siteName}
              </h1>
            )}
            <p className="text-white/70 mt-2 text-lg">Television Studio Management</p>
          </div>
          
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {activeTab === "login" && "Sign In"}
                {activeTab === "forgot-password" && "Reset Password"}
                {activeTab === "register" && "Create Account"}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                {activeTab === "login" && "Welcome back to BookStud.io"}
                {activeTab === "forgot-password" && "We'll send you a reset link"}
                {activeTab === "register" && "Get started with studio booking"}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="login" className="mt-0">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Username
                    </Label>
                    <Input
                      id="username"
                      placeholder="Enter your username"
                      className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...loginForm.register("username")}
                      data-testid="input-username"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...loginForm.register("password")}
                      data-testid="input-password"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      type="button"
                      className="text-sm text-[#003366] dark:text-blue-400 hover:underline"
                      onClick={() => setActiveTab("forgot-password")}
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="forgot-password" className="mt-0">
              {forgotPasswordSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                      Check your email
                    </h3>
                    <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                      If an account exists with that email, we've sent reset instructions.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={() => {
                      setActiveTab("login");
                      setForgotPasswordSuccess(false);
                      forgotPasswordForm.reset();
                    }}
                    data-testid="button-return-login"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Enter your email and we'll send you a reset link.
                    </p>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="forgot-password-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email
                      </Label>
                      <Input
                        id="forgot-password-email"
                        type="email"
                        placeholder="Enter your email address"
                        className="h-11 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                        {...forgotPasswordForm.register("email")}
                        data-testid="input-forgot-email"
                      />
                      {forgotPasswordForm.formState.errors.email && (
                        <p className="text-sm text-red-500">{forgotPasswordForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        type="submit" 
                        className="w-full h-11 bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium"
                        disabled={forgotPasswordLoading}
                        data-testid="button-send-reset"
                      >
                        {forgotPasswordLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full h-11 text-gray-600 dark:text-gray-400"
                        onClick={() => {
                          setActiveTab("login");
                          forgotPasswordForm.reset();
                        }}
                        data-testid="button-back-login"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to sign in
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </TabsContent>
            
            <TabsContent value="register" className="mt-0">
              <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter your full name"
                      className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...registerForm.register("name")}
                      data-testid="input-name"
                    />
                    {registerForm.formState.errors.name && (
                      <p className="text-xs text-red-500">{registerForm.formState.errors.name.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...registerForm.register("email")}
                      data-testid="input-email"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-xs text-red-500">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="register-username" className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</Label>
                    <Input
                      id="register-username"
                      placeholder="Choose a username"
                      className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...registerForm.register("username")}
                      data-testid="input-register-username"
                    />
                    {registerForm.formState.errors.username && (
                      <p className="text-xs text-red-500">{registerForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Choose a password"
                      className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...registerForm.register("password")}
                      data-testid="input-register-password"
                    />
                    {registerForm.formState.errors.password && (
                      <p className="text-xs text-red-500">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      {...registerForm.register("confirmPassword")}
                      data-testid="input-confirm-password"
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-red-500">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-[#003366] hover:bg-[#002244] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium mt-2"
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
          </div>
        </div>
        
        <div className="hidden lg:block w-full lg:w-1/2">
          <div className="rounded-2xl overflow-hidden shadow-2xl">
            <video 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-auto"
            >
              <source src={promoVideo} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
  );
}
