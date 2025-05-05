import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import logoPath from "../assets/logo.png";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

// Form validation schema
const inviteFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

export default function InvitePage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [inviteData, setInviteData] = useState<{email: string, role: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get token from URL
  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      navigate("/");
      return;
    }
    
    const path = window.location.pathname;
    const pathParts = path.split('/');
    
    console.log("InvitePage - Current path:", path);
    console.log("InvitePage - Path parts:", pathParts);
    
    if (pathParts.length >= 3 && pathParts[1] === 'invite') {
      const inviteToken = pathParts[2];
      console.log("InvitePage - Found token:", inviteToken);
      setToken(inviteToken);
      validateToken(inviteToken);
    } else {
      console.log("InvitePage - Invalid path format");
      setValidatingToken(false);
      setError("Invalid invitation link");
    }
  }, [user, navigate]);
  
  // Validate the token
  const validateToken = async (token: string) => {
    try {
      const response = await apiRequest("GET", `/api/invite/${token}`);
      const data = await response.json();
      
      if (response.ok && data.valid) {
        setTokenValid(true);
        setInviteData({
          email: data.email,
          role: data.role
        });
      } else {
        setError(data.message || "Invalid or expired invitation");
      }
    } catch (error) {
      console.error("Error validating invite token:", error);
      setError("Error validating invitation");
    } finally {
      setValidatingToken(false);
    }
  };
  
  // Form setup
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      name: "",
      email: inviteData?.email || "",
      username: "",
      password: "",
      confirmPassword: "",
    }
  });
  
  // Update email field when inviteData changes
  useEffect(() => {
    if (inviteData?.email) {
      form.setValue("email", inviteData.email);
    }
  }, [inviteData, form]);
  
  const onSubmit = async (data: InviteFormData) => {
    if (!token) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", `/api/register/invite/${token}`, data);
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || "Registration failed");
      }
      
      toast({
        title: "Registration successful!",
        description: "Your account has been created. Redirecting to dashboard...",
        variant: "default",
      });
      
      // Wait a moment, then navigate to dashboard
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Registration error:", error);
      setError(error.message || "Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loader while validating token
  if (validatingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-500">Validating invitation...</p>
        </div>
      </div>
    );
  }
  
  // Show error if token is invalid
  if (!tokenValid && !validatingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <img src={logoPath} alt="BookStud.io logo" className="h-20" />
            </div>
            <CardTitle className="text-2xl text-center">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error || "This invitation link is invalid or has expired. Please contact the administrator for a new invitation."}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Main registration form
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <div className="mb-4 flex justify-center">
              <img src={logoPath} alt="BookStud.io logo" className="h-20" />
            </div>
            <CardTitle className="text-2xl text-center">Complete Your Registration</CardTitle>
            <CardDescription className="text-center">
              {inviteData && (
                <>You've been invited to join as a <strong className="capitalize">{inviteData.role}</strong></>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  readOnly={!!inviteData?.email}
                  className={inviteData?.email ? "bg-gray-100" : ""}
                  {...form.register("email")}
                />
                {inviteData?.email && (
                  <p className="text-xs text-muted-foreground flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                    This email address is associated with your invitation
                  </p>
                )}
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Choose a username"
                  {...form.register("username")}
                />
                {form.formState.errors.username && (
                  <p className="text-sm text-red-500">{form.formState.errors.username.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Choose a password"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  {...form.register("confirmPassword")}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
              
              <div className="text-center">
                <Button
                  variant="link"
                  className="text-sm"
                  type="button"
                  onClick={() => navigate("/auth")}
                >
                  Already have an account? Sign in
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}