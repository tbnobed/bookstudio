import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-[#003366] dark:bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logoPath} alt="BookStud.io" className="h-60 w-auto dark:hidden" />
          <img src={logoDarkPath} alt="BookStud.io" className="h-60 w-auto hidden dark:block" />
        </div>
        
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
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
        
        <p className="text-center text-white/70 dark:text-gray-400 text-sm mt-6">
          Television Studio Management System
        </p>
      </div>
    </div>
  );
}
