import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoPath from "../assets/logo.png";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // Validate the token
  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await apiRequest("GET", `/api/reset-password/${params.token}`);
        const data = await response.json();
        
        if (data.valid) {
          setIsValidToken(true);
        } else {
          toast({
            title: "Invalid or expired token",
            description: "This password reset link is invalid or has expired. Please request a new one.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Token validation error:", error);
        toast({
          title: "An error occurred",
          description: "Unable to validate your reset token. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsValidating(false);
      }
    };
    
    if (params.token) {
      validateToken();
    } else {
      setIsValidating(false);
      toast({
        title: "Invalid request",
        description: "No reset token provided.",
        variant: "destructive",
      });
    }
  }, [params.token, toast]);
  
  // Password reset schema
  const resetPasswordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
  
  // Form setup
  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  
  // Submit handler
  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    if (!params.token) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await apiRequest("POST", `/api/reset-password/${params.token}`, {
        password: data.password,
      });
      
      const result = await response.json();
      
      if (result.success) {
        setIsComplete(true);
        toast({
          title: "Password reset successful",
          description: "Your password has been reset successfully. You can now log in with your new password.",
          variant: "default",
        });
      } else {
        toast({
          title: "Password reset failed",
          description: result.message || "Failed to reset your password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "An error occurred",
        description: "Failed to reset your password. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-[350px]">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="BookStud.io logo" className="h-24 w-auto" />
            </div>
            <CardTitle className="text-center">Validating reset link...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Invalid token state
  if (!isValidToken && !isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="BookStud.io logo" className="h-24 w-auto" />
            </div>
            <CardTitle className="text-center">Reset Link Expired</CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Please request a new password reset link.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => navigate("/auth")}>
                  Return to Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Success state
  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="BookStud.io logo" className="h-24 w-auto" />
            </div>
            <CardTitle className="text-center">Password Reset Complete</CardTitle>
            <CardDescription className="text-center">
              Your password has been reset successfully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                You can now log in with your new password.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => navigate("/auth")}>
                  Go to Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <img src={logoPath} alt="BookStud.io logo" className="h-24 w-auto" />
          </div>
          <CardTitle className="text-center">Reset Your Password</CardTitle>
          <CardDescription className="text-center">
            Create a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetPasswordForm.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter new password"
                  {...resetPasswordForm.register("password")}
                />
                {resetPasswordForm.formState.errors.password && (
                  <p className="text-sm text-red-500">
                    {resetPasswordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  {...resetPasswordForm.register("confirmPassword")}
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500">
                    {resetPasswordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Resetting Password..." : "Reset Password"}
              </Button>
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  className="text-sm"
                  onClick={() => navigate("/auth")}
                >
                  Back to Login
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}