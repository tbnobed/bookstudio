import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertUserSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import logoPath from "../assets/logo.png";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  
  // State for forgot password flow
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

  // Use our Auth Context
  const { loginMutation, registerMutation, user } = useAuth();
  
  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    console.log("Login form submitted with data:", data);
    // Use the mutation directly without additional callbacks
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: z.infer<typeof registerSchema>) => {
    // Remove confirmPassword as it's not in the schema
    const { confirmPassword, ...registerData } = data;
    // Add role as producer by default
    const userData = { ...registerData, role: "producer" };
    
    console.log("Register form submitted with data:", userData);
    
    // Use the mutation directly without additional callbacks
    registerMutation.mutate(userData);
  };

  const onForgotPasswordSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
    try {
      setForgotPasswordLoading(true);
      
      // Include the current origin in the request
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
    <div className="min-h-screen flex">
      {/* Left side - Auth form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-2">
        <Card className="w-full max-w-md p-2">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="BookStud.io logo" className="h-60 w-auto" />
            </div>
            {/* No description text needed */}
          </CardHeader>
          <CardContent>
            <div className="w-full">
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="Enter your username"
                      {...loginForm.register("username")}
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      {...loginForm.register("password")}
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? "Signing In..." : "Sign In"}
                  </Button>
                </div>
              </form>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full hidden">
              <TabsContent value="login">
                {/* Keeping this empty but hidden for structure */}
              </TabsContent>
              
              <TabsContent value="forgot-password">
                {forgotPasswordSuccess ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                      <h3 className="text-lg font-semibold text-green-800 mb-2">Check your email</h3>
                      <p className="text-green-700">
                        If an account exists with that email address, we've sent instructions to reset your password.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setActiveTab("login");
                          setForgotPasswordSuccess(false);
                          forgotPasswordForm.reset();
                        }}
                      >
                        Return to Sign In
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Enter your email address and we'll send you a link to reset your password.
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="forgot-password-email">Email</Label>
                        <Input
                          id="forgot-password-email"
                          type="email"
                          placeholder="Enter your email address"
                          {...forgotPasswordForm.register("email")}
                        />
                        {forgotPasswordForm.formState.errors.email && (
                          <p className="text-sm text-red-500">{forgotPasswordForm.formState.errors.email.message}</p>
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={forgotPasswordLoading}
                        >
                          {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setActiveTab("login");
                            forgotPasswordForm.reset();
                          }}
                        >
                          Back to Sign In
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter your full name"
                        {...registerForm.register("name")}
                      />
                      {registerForm.formState.errors.name && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        {...registerForm.register("email")}
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="register-username"
                        placeholder="Choose a username"
                        {...registerForm.register("username")}
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.username.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Choose a password"
                        {...registerForm.register("password")}
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm your password"
                        {...registerForm.register("confirmPassword")}
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-500">{registerForm.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Right side - Hero section */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-primary to-primary-foreground flex-col justify-center items-center p-8 text-white">
        <div className="max-w-md space-y-6">
          <div className="mb-4">
            <img src={logoPath} alt="BookStud.io logo" className="h-60 w-auto" />
          </div>
          <p className="text-xl">
            The complete studio booking platform for broadcast facilities. Manage bookings, create templates, and track schedules all in one place.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-white/20 p-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Streamlined Booking</h3>
                <p className="text-sm text-white/80">
                  Book studios with just a few clicks and view your entire schedule in one place.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-white/20 p-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layout-template">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Template Management</h3>
                <p className="text-sm text-white/80">
                  Create reusable templates for common setups and configurations.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-white/20 p-1 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium">Notifications</h3>
                <p className="text-sm text-white/80">
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