import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Edit, Trash2, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Team, User, TeamMember } from "@shared/schema";

const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

const memberSchema = z.object({
  userId: z.number().min(1, "Please select a user"),
  role: z.enum(["member", "admin"]).default("member"),
});

type TeamFormData = z.infer<typeof teamSchema>;
type MemberFormData = z.infer<typeof memberSchema>;

export default function TeamsPage() {
  const { toast } = useToast();
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Forms
  const teamForm = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const memberForm = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      role: "member",
    },
  });

  // Queries
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: teamMembers = [], refetch: refetchMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeam?.id, "members"],
    queryFn: async () => {
      if (!selectedTeam?.id) return [];
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`);
      if (!response.ok) throw new Error('Failed to fetch team members');
      const data = await response.json();
      console.log('Custom queryFn received team members data:', data);
      return data;
    },
    enabled: !!selectedTeam,
  });



  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      const res = await apiRequest("POST", "/api/teams", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsTeamDialogOpen(false);
      teamForm.reset();
      toast({
        title: "Success",
        description: "Team created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TeamFormData }) => {
      const res = await apiRequest("PUT", `/api/teams/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsTeamDialogOpen(false);
      setEditingTeam(null);
      teamForm.reset();
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/teams/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: MemberFormData) => {
      const res = await apiRequest("POST", `/api/teams/${selectedTeam?.id}/members`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchMembers();
      setIsMemberDialogOpen(false);
      memberForm.reset();
      toast({
        title: "Success",
        description: "Team member added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: number }) => {
      await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      refetchMembers();
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmitTeam = (data: TeamFormData) => {
    if (editingTeam) {
      updateTeamMutation.mutate({ id: editingTeam.id, data });
    } else {
      createTeamMutation.mutate(data);
    }
  };

  const onSubmitMember = (data: MemberFormData) => {
    addMemberMutation.mutate(data);
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    teamForm.reset({
      name: team.name,
      description: team.description || "",
    });
    setIsTeamDialogOpen(true);
  };

  const handleDeleteTeam = (id: number) => {
    if (confirm("Are you sure you want to delete this team? This action cannot be undone.")) {
      deleteTeamMutation.mutate(id);
    }
  };

  const handleRemoveMember = (teamId: number, userId: number) => {
    if (confirm("Are you sure you want to remove this member from the team?")) {
      removeMemberMutation.mutate({ teamId, userId });
    }
  };

  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    console.log('getUserName called with userId:', userId, 'found user:', user, 'all users:', users);
    return user ? (user.name || user.username) : `User ${userId}`;
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Team Management</h1>
          <p className="text-muted-foreground">
            Create and manage teams for collaborative booking visibility
          </p>
        </div>
        <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingTeam(null);
                teamForm.reset({ name: "", description: "" });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTeam ? "Edit Team" : "Create New Team"}</DialogTitle>
              <DialogDescription>
                {editingTeam ? "Update team details" : "Create a new team for collaborative booking management"}
              </DialogDescription>
            </DialogHeader>
            <Form {...teamForm}>
              <form onSubmit={teamForm.handleSubmit(onSubmitTeam)} className="space-y-4">
                <FormField
                  control={teamForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter team name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={teamForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Team description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTeamDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTeamMutation.isPending || updateTeamMutation.isPending}
                  >
                    {editingTeam ? "Update" : "Create"} Team
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Teams
          </h2>
          {teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No teams yet. Create your first team to enable collaborative booking management.
                </p>
              </CardContent>
            </Card>
          ) : (
            teams.map((team) => (
              <Card key={team.id} className={`cursor-pointer transition-colors ${
                selectedTeam?.id === team.id ? 'ring-2 ring-primary' : ''
              }`} onClick={() => setSelectedTeam(team)}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{team.name}</CardTitle>
                      {team.description && (
                        <CardDescription className="mt-1">
                          {team.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTeam(team);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(team.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Team Members */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {selectedTeam ? `${selectedTeam.name} Members` : "Select a team"}
            </h2>
            {selectedTeam && (
              <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Add a new member to {selectedTeam.name}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...memberForm}>
                    <form onSubmit={memberForm.handleSubmit(onSubmitMember)} className="space-y-4">
                      <FormField
                        control={memberForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>User</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users
                                  .filter(user => !teamMembers.some(member => member.userId === user.id))
                                  .map((user) => (
                                    <SelectItem key={user.id} value={user.id.toString()}>
                                      {user.name} ({user.email})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={memberForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsMemberDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={addMemberMutation.isPending}>
                          Add Member
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {selectedTeam ? (
            teamMembers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No members in this team yet. Add members to enable collaboration.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <Card key={`${member.teamId}-${member.userId}`}>
                    <CardContent className="flex justify-between items-center py-3">
                      <div>
                        <p className="font-medium">{getUserName(member.userId)}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Unknown'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                          {member.role}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMember(member.teamId, member.userId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Select a team to view and manage its members.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}