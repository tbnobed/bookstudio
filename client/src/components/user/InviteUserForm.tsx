import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Copy, Check } from "lucide-react";

// Form validation schema
const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "producer", "production", "production_coordinator", "engineer", "it", "site_manager", "viewer"])
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

export default function InviteUserForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form setup
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "producer" // Default role
    }
  });
  
  // Send invitation mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      // Get the origin for proper invite link generation
      const origin = window.location.origin;
      const response = await apiRequest("POST", "/api/invite", { 
        ...data, 
        origin 
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send invitation");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Invitation sent",
          description: data.message,
          variant: "default",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/invites/pending"] });
        // Store the full invite link for copying
        const fullInviteLink = `${window.location.origin}${data.inviteLink}`;
        setInviteLink(fullInviteLink);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const onSubmit = (data: InviteFormData) => {
    inviteMutation.mutate(data);
  };
  
  // Copy invite link to clipboard
  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
      
      toast({
        title: "Copied to clipboard",
        description: "The invitation link has been copied to your clipboard",
        variant: "default",
      });
    }
  };
  
  // Reset form when dialog closes
  const handleDialogChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      form.reset();
      setInviteLink(null);
      setCopied(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button>Invite User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new user</DialogTitle>
          <DialogDescription>
            Send an invitation to join BookStud.io. The user will receive an email with registration instructions.
          </DialogDescription>
        </DialogHeader>
        
        {inviteLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-md border border-green-200">
              <h4 className="font-medium text-green-900">Invitation sent</h4>
              <p className="text-sm text-green-700">
                An invitation has been sent to the email address. You can also copy the link below and share it directly.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Input 
                value={inviteLink} 
                readOnly 
                className="flex-1 text-sm bg-gray-50" 
              />
              <Button 
                size="icon" 
                variant="outline" 
                onClick={copyToClipboard}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={() => setIsOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                defaultValue={form.getValues().role} 
                onValueChange={(value) => form.setValue("role", value as any)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="production_coordinator">Production Coordinator</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                  <SelectItem value="it">IT</SelectItem>
                  <SelectItem value="site_manager">Site Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-red-500">{form.formState.errors.role.message}</p>
              )}
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}