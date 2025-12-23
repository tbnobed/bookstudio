import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Calendar, FileText, Bell, ArrowLeft, Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Left side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo for mobile */}
          <div className="flex justify-center mb-8 lg:hidden">
            <img src={logoPath} alt="BookStud.io" className="h-24 w-auto dark:hidden" />
            <img src={logoDarkPath} alt="BookStud.io" className="h-24 w-auto hidden dark:block" />
          </div>
          
          <Card className="border-0 shadow-xl bg-white dark:bg-gray-900">
            <CardHeader className="space-y-1 pb-6">
              <div className="flex justify-center mb-4 lg:hidden">
                <img src={logoPath} alt="BookStud.io" className="h-16 w-auto dark:hidden" />
                <img src={logoDarkPath} alt="BookStud.io" className="h-16 w-auto hidden dark:block" />
              </div>
              <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                {activeTab === "login" && "Welcome back"}
                {activeTab === "forgot-password" && "Reset password"}
                {activeTab === "register" && "Create account"}
              </h2>
              <p className="text-center text-gray-500 dark:text-gray-400">
                {activeTab === "login" && "Sign in to manage your studio bookings"}
                {activeTab === "forgot-password" && "We'll send you a reset link"}
                {activeTab === "register" && "Get started with BookStud.io"}
              </p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsContent value="login" className="mt-0">
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-sm font-medium">
                          Username
                        </Label>
                        <Input
                          id="username"
                          placeholder="Enter your username"
                          className="h-11"
                          {...loginForm.register("username")}
                          data-testid="input-username"
                        />
                        {loginForm.formState.errors.username && (
                          <p className="text-sm text-red-500">{loginForm.formState.errors.username.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">
                          Password
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          className="h-11"
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
                          className="text-sm text-primary hover:underline"
                          onClick={() => setActiveTab("forgot-password")}
                          data-testid="link-forgot-password"
                        >
                          Forgot password?
                        </button>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full h-11 text-base"
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign in"
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
                
                <TabsContent value="forgot-password" className="mt-0">
                  {forgotPasswordSuccess ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                          Check your email
                        </h3>
                        <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                          If an account exists with that email address, we've sent instructions to reset your password.
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
                        Return to sign in
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Enter your email address and we'll send you a link to reset your password.
                        </p>
                        
                        <div className="space-y-2">
                          <Label htmlFor="forgot-password-email" className="text-sm font-medium">
                            Email
                          </Label>
                          <Input
                            id="forgot-password-email"
                            type="email"
                            placeholder="Enter your email address"
                            className="h-11"
                            {...forgotPasswordForm.register("email")}
                            data-testid="input-forgot-email"
                          />
                          {forgotPasswordForm.formState.errors.email && (
                            <p className="text-sm text-red-500">{forgotPasswordForm.formState.errors.email.message}</p>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <Button 
                            type="submit" 
                            className="w-full h-11"
                            disabled={forgotPasswordLoading}
                            data-testid="button-send-reset"
                          >
                            {forgotPasswordLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send reset link"
                            )}
                          </Button>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full h-11"
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
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                        <Input
                          id="name"
                          placeholder="Enter your full name"
                          className="h-11"
                          {...registerForm.register("name")}
                          data-testid="input-name"
                        />
                        {registerForm.formState.errors.name && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.name.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          className="h-11"
                          {...registerForm.register("email")}
                          data-testid="input-email"
                        />
                        {registerForm.formState.errors.email && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="register-username" className="text-sm font-medium">Username</Label>
                        <Input
                          id="register-username"
                          placeholder="Choose a username"
                          className="h-11"
                          {...registerForm.register("username")}
                          data-testid="input-register-username"
                        />
                        {registerForm.formState.errors.username && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.username.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="Choose a password"
                          className="h-11"
                          {...registerForm.register("password")}
                          data-testid="input-register-password"
                        />
                        {registerForm.formState.errors.password && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Confirm your password"
                          className="h-11"
                          {...registerForm.register("confirmPassword")}
                          data-testid="input-confirm-password"
                        />
                        {registerForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-red-500">{registerForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full h-11 text-base"
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create account"
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Right side - Hero section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-800 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 max-w-lg space-y-8">
          <div className="flex justify-center mb-6">
            <img src={logoPath} alt="BookStud.io" className="h-32 w-auto drop-shadow-xl dark:hidden" />
            <img src={logoDarkPath} alt="BookStud.io" className="h-32 w-auto drop-shadow-xl hidden dark:block" />
          </div>
          
          <p className="text-xl text-white/90 text-center leading-relaxed">
            The complete studio booking platform for broadcast facilities. Manage bookings, create templates, and track schedules all in one place.
          </p>
          
          <div className="space-y-5 pt-4">
            <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex-shrink-0 bg-white/20 p-2.5 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Streamlined Booking</h3>
                <p className="text-sm text-white/80 mt-1">
                  Book studios with just a few clicks and view your entire schedule in one place.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex-shrink-0 bg-white/20 p-2.5 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Template Management</h3>
                <p className="text-sm text-white/80 mt-1">
                  Create reusable templates for common setups and configurations.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex-shrink-0 bg-white/20 p-2.5 rounded-lg">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Smart Notifications</h3>
                <p className="text-sm text-white/80 mt-1">
                  Get timely alerts about your bookings, conflicts, and maintenance schedules.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
