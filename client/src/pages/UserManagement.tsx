import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, Pencil, Trash2, UserPlus, Mail, X, Clock, Send, ShieldCheck, ShieldOff, Shield } from "lucide-react";
import InviteUserForm from "@/components/user/InviteUserForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showForceDeleteDialog, setShowForceDeleteDialog] = useState(false);
  const [forceDeleteError, setForceDeleteError] = useState<any>(null);
  
  // New user form state
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    name: "",
    role: "producer"
  });
  
  // Edit user form state
  const [editUser, setEditUser] = useState({
    username: "",
    email: "",
    name: "",
    role: "",
    password: ""
  });
  
  // Toggle for showing password field in edit form
  const [showPasswordField, setShowPasswordField] = useState(false);

  // Fetch users
  type PendingInvite = { id: number; email: string; role: string; createdAt: string | null; expires: string };

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin" || user?.role === "site_manager",
  });

  const { data: pendingInvites = [], isLoading: invitesLoading } = useQuery<PendingInvite[]>({
    queryKey: ["/api/invites/pending"],
    enabled: user?.role === "admin" || user?.role === "site_manager",
  });

  const { data: ssoConfig } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/sso-config"],
  });
  const ssoEnabled = ssoConfig?.enabled === true;

  const linkedCount = users.filter(u => (u as any).ssoProvider).length;
  const localOnlyCount = users.length - linkedCount;
  const migrationPct = users.length > 0 ? Math.round((linkedCount / users.length) * 100) : 0;

  const revokeInvite = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/invites/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite revoked", description: "The invitation has been cancelled." });
      queryClient.invalidateQueries({ queryKey: ["/api/invites/pending"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke invite.", variant: "destructive" });
    }
  });

  const resendInvite = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/invites/${id}/resend`, { origin: window.location.origin });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend invite.");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Invite resent", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/invites/pending"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: InsertUser) => {
      const res = await apiRequest("POST", "/api/users", userData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "User created successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateUserOpen(false);
      
      // Reset form
      setNewUser({
        username: "",
        password: "",
        email: "",
        name: "",
        role: "producer"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });
  
  // Update user mutation
  const updateUser = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: Partial<InsertUser> }) => {
      // If password field is empty, remove it from the payload
      if (userData.password === "") {
        const { password, ...dataWithoutPassword } = userData;
        const res = await apiRequest("PATCH", `/api/users/${id}`, dataWithoutPassword);
        return res.json();
      }
      
      const res = await apiRequest("PATCH", `/api/users/${id}`, userData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "User updated successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });
  
  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async ({ id, force = false }: { id: number; force?: boolean }) => {
      const url = force ? `/api/users/${id}?force=true` : `/api/users/${id}`;
      const res = await apiRequest("DELETE", url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success!",
        description: variables.force 
          ? "User deleted successfully (associated data reassigned to admin)."
          : "User deleted successfully.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteUserOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      console.log("User delete error:", error);
      console.log("Error message:", error.message);
      console.log("Error type:", typeof error.message);
      
      try {
        const errorData = JSON.parse(error.message);
        console.log("Parsed error data:", errorData);
        
        if (errorData.canForceDelete) {
          // Show force delete option
          setForceDeleteError(errorData);
          setShowForceDeleteDialog(true);
          setIsDeleteUserOpen(false); // Close the regular delete dialog
        } else {
          toast({
            title: "Error",
            description: errorData.message || "Failed to delete user",
            variant: "destructive",
          });
        }
      } catch (parseError) {
        console.log("Parse error:", parseError);
        
        // If we can't parse the error, check if it contains force delete hints
        const errorMessage = error.message || "";
        if (errorMessage.includes("canForceDelete") || errorMessage.includes("forceDeleteHint")) {
          // Extract the error data from the raw message
          try {
            const match = errorMessage.match(/\{.*\}/);
            if (match) {
              const errorData = JSON.parse(match[0]);
              if (errorData.canForceDelete) {
                setForceDeleteError(errorData);
                setShowForceDeleteDialog(true);
                setIsDeleteUserOpen(false);
                return;
              }
            }
          } catch (extractError) {
            console.log("Failed to extract error data:", extractError);
          }
        }
        
        toast({
          title: "Error",
          description: error.message || "Failed to delete user",
          variant: "destructive",
        });
      }
    },
  });

  // Handle form input change for new user
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewUser({
      ...newUser,
      [e.target.name]: e.target.value
    });
  };

  // Handle role change for new user
  const handleRoleChange = (role: string) => {
    setNewUser({
      ...newUser,
      role
    });
  };

  // Handle form input change for edit user
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditUser({
      ...editUser,
      [e.target.name]: e.target.value
    });
  };

  // Handle role change for edit user
  const handleEditRoleChange = (role: string) => {
    setEditUser({
      ...editUser,
      role
    });
  };

  // Handle create user form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutateAsync(newUser);
  };
  
  // Handle edit user form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUser.mutateAsync({
        id: selectedUser.id,
        userData: editUser
      });
    }
  };
  
  // Open edit user dialog
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUser({
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      password: ""
    });
    setShowPasswordField(false);
    setIsEditUserOpen(true);
  };
  
  // Open delete user dialog
  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };
  
  // Confirm user deletion
  const confirmDeleteUser = (force = false) => {
    if (selectedUser) {
      deleteUser.mutate({ id: selectedUser.id, force });
    }
  };

  // Handle force delete confirmation
  const handleForceDelete = () => {
    setShowForceDeleteDialog(false);
    if (selectedUser) {
      deleteUser.mutateAsync({ id: selectedUser.id, force: true });
    }
  };

  // Format role for display
  const formatRole = (role: string) => {
    if (role === "site_manager") {
      return "Site Manager";
    }
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Get role color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-300";
      case "producer":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "production":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "engineer":
        return "bg-green-100 text-green-800 border-green-300";
      case "it":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "site_manager":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (user?.role !== "admin" && user?.role !== "site_manager") {
    return (
      <div className="flex flex-col h-screen">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          view="week"
          onViewChange={() => {}}
          title="User Management"
          showViewToggle={false}
        />
        <div className="container mx-auto p-4 flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex mb-4 gap-2 justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h1 className="text-2xl font-bold">Access Denied</h1>
              </div>
              <p className="text-center text-gray-600">
                You don't have permission to access the User Management page. Only administrators and site managers can manage users.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="User Management"
        showViewToggle={false}
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex space-x-3">
            <InviteUserForm />
            <Button onClick={() => setIsCreateUserOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create User
            </Button>
          </div>
        </div>

        {ssoEnabled && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                SSO Migration Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
                    <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{linkedCount}</p>
                    <p className="text-xs text-gray-500">SSO linked</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800">
                    <ShieldOff className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{localOnlyCount}</p>
                    <p className="text-xs text-gray-500">local only</p>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Migration</span>
                    <span className="font-medium">{migrationPct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${migrationPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Local-only users will be linked automatically on their first SSO login — as long as their email matches.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Name</th>
                      <th className="text-left py-3 px-4 font-medium">Username</th>
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      {ssoEnabled && <th className="text-left py-3 px-4 font-medium">SSO</th>}
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(userData => (
                      <tr key={userData.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{userData.name}</td>
                        <td className="py-3 px-4">{userData.username}</td>
                        <td className="py-3 px-4">{userData.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={getRoleBadgeColor(userData.role)}>
                            {formatRole(userData.role)}
                          </Badge>
                        </td>
                        {ssoEnabled && (
                          <td className="py-3 px-4">
                            {(userData as any).ssoProvider ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-2 py-0.5">
                                <ShieldCheck className="h-3 w-3" />
                                Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                                <ShieldOff className="h-3 w-3" />
                                Local
                              </span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right">
                          {/* Don't allow editing or deleting the current user to prevent self-lockout */}
                          {userData.id !== user?.id ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditUser(userData)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteUser(userData)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-sm text-gray-500 italic">Current user</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              Pending Invitations
              {pendingInvites.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingInvites.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-primary" />
              </div>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No pending invitations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-left py-3 px-4 font-medium">Sent</th>
                      <th className="text-left py-3 px-4 font-medium">Expires</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map(invite => {
                      const expiresDate = new Date(invite.expires);
                      const sentDate = invite.createdAt ? new Date(invite.createdAt) : null;
                      const hoursLeft = Math.round((expiresDate.getTime() - Date.now()) / 36e5);
                      const expiringSoon = hoursLeft < 24;
                      return (
                        <tr key={invite.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{invite.email}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={getRoleBadgeColor(invite.role)}>
                              {formatRole(invite.role)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {sentDate ? sentDate.toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`flex items-center gap-1 text-sm ${expiringSoon ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                              <Clock className="h-3.5 w-3.5" />
                              {expiringSoon ? `${hoursLeft}h left` : expiresDate.toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                disabled={resendInvite.isPending || revokeInvite.isPending}
                                onClick={() => resendInvite.mutate(invite.id)}
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Resend
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                disabled={revokeInvite.isPending || resendInvite.isPending}
                                onClick={() => revokeInvite.mutate(invite.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Revoke
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={newUser.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={newUser.username}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={newUser.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={newUser.password}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newUser.role} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="site_manager">Site Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={editUser.name}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  name="username"
                  value={editUser.username}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                name="email"
                type="email"
                value={editUser.email}
                onChange={handleEditInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editUser.role} onValueChange={handleEditRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="site_manager">Site Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="change-password">Change Password</Label>
                <Switch 
                  id="change-password" 
                  checked={showPasswordField}
                  onCheckedChange={setShowPasswordField}
                />
              </div>
              
              {showPasswordField && (
                <div className="space-y-2">
                  <Label htmlFor="edit-password">New Password</Label>
                  <Input
                    id="edit-password"
                    name="password"
                    type="password"
                    value={editUser.password}
                    onChange={handleEditInputChange}
                    required={showPasswordField}
                    placeholder="Enter new password"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to keep the current password
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUser.isPending}>
                {updateUser.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription className="pt-2 text-red-600">
              This action cannot be undone. 
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="mb-4">
              Are you sure you want to delete the user <strong>{selectedUser?.name}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              This will permanently remove the user account and all associated data from the system.
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDeleteUserOpen(false)}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={() => confirmDeleteUser(false)}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Delete Confirmation Dialog */}
      <Dialog open={showForceDeleteDialog} onOpenChange={setShowForceDeleteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-orange-600">Force Delete User</DialogTitle>
            <DialogDescription className="pt-2">
              This user has associated data that prevents normal deletion.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 font-medium mb-2">
                Dependency Warning:
              </p>
              <p className="text-sm text-orange-700">
                {forceDeleteError?.message}
              </p>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                Force deletion will:
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Reassign all user's bookings to the admin user</li>
                <li>• Reassign all user's templates to the admin user</li>
                <li>• Permanently delete the user account</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600">
              Are you sure you want to force delete <strong>{selectedUser?.name}</strong>?
            </p>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowForceDeleteDialog(false)}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleForceDelete}
              disabled={deleteUser.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {deleteUser.isPending ? "Force Deleting..." : "Force Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
