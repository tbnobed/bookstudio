import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { Loader2, Copy, Check } from "lucide-react";

// Form validation schema - site managers can only invite producers
const inviteFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.literal("producer") // Only producer role allowed
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

export default function SiteManagerInviteForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // Form setup
  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "producer" // Only producer role is allowed
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
        <Button>Invite Producer</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a new Producer</DialogTitle>
          <DialogDescription>
            Send an invitation to join BookStud.io as a Producer. The user will receive an email with registration instructions.
          </DialogDescription>
        </DialogHeader>
        
        {inviteLink ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-md border border-green-200">
              <p className="mb-2 text-green-700 font-medium">Invitation sent successfully</p>
              <p className="text-sm text-green-600">You can share this invitation link with the user:</p>
              <div className="flex items-center mt-2">
                <div className="flex-1 overflow-auto p-2 bg-white border border-green-200 rounded text-sm">
                  {inviteLink}
                </div>
                <Button
                  variant="outline"
                  size="sm" 
                  className="ml-2 h-9 px-2"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => handleDialogChange(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="Enter email address"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value="Producer"
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">As a Site Manager, you can only invite users with the Producer role</p>
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