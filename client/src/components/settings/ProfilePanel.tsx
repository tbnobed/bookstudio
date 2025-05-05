import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Switch } from "@/components/ui/switch";

export default function ProfilePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [userData, setUserData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    confirmPassword: ""
  });
  
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  
  // Update user mutation
  const updateProfile = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const res = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Reset password fields
      setUserData(prev => ({
        ...prev,
        password: "",
        confirmPassword: ""
      }));
      setShowPasswordFields(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!userData.name.trim() || !userData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    // Validate password if changing
    if (showPasswordFields) {
      if (!userData.password) {
        toast({
          title: "Password Required",
          description: "Please enter your new password",
          variant: "destructive",
        });
        return;
      }
      
      if (userData.password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }
      
      if (userData.password !== userData.confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Your password and confirmation password do not match",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Prepare payload
    const payload: Partial<User> = {
      name: userData.name,
      email: userData.email,
    };
    
    // Only include password if it's being changed
    if (showPasswordFields && userData.password) {
      payload.password = userData.password;
    }
    
    updateProfile.mutateAsync(payload);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
        <CardDescription>Update your account information and password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={user?.username || ""}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">Your username cannot be changed</p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                value={userData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={userData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <Label htmlFor="change-password">Change Password</Label>
                <Switch 
                  id="change-password" 
                  checked={showPasswordFields}
                  onCheckedChange={setShowPasswordFields}
                />
              </div>
              
              {showPasswordFields && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={userData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={userData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}