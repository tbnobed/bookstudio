import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Copy, RefreshCw, Calendar, Smartphone, CheckCheck } from "lucide-react";
import QRCode from "react-qr-code";

// Form validation schema
const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  changePassword: z.boolean().default(false),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .optional()
    .or(z.literal('')),
  confirmPassword: z
    .string()
    .optional()
    .or(z.literal(''))
}).refine(data => {
  if (data.changePassword) {
    return data.password !== undefined && data.password !== '';
  }
  return true;
}, {
  message: "Password is required when changing password",
  path: ["password"],
}).refine(data => {
  if (data.changePassword && data.password && data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// ─── Calendar Sync Panel ─────────────────────────────────────────────────────

function CalendarSyncPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: tokenData, isLoading } = useQuery<{ token: string }>({
    queryKey: ["/api/user/calendar-token"],
  });

  const regenerate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/calendar-token/regenerate").then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/calendar-token"] });
      toast({ title: "New calendar URL generated", description: "Your old subscription link is now invalid." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not regenerate the calendar URL.", variant: "destructive" });
    },
  });

  const feedUrl = tokenData?.token
    ? `${window.location.origin}/api/calendar/${tokenData.token}.ics`
    : "";

  const handleCopy = async () => {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Subscription URL copied to clipboard." });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <CardTitle>Calendar Sync</CardTitle>
        </div>
        <CardDescription>
          Subscribe to your bookings in iPhone Calendar, Google Calendar, or any app that supports iCal feeds. The calendar updates automatically every hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* URL field + copy */}
        <div className="space-y-2">
          <Label>Your subscription URL</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={isLoading ? "Loading…" : feedUrl}
              className="font-mono text-xs bg-muted"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              disabled={isLoading || !feedUrl}
              title="Copy URL"
            >
              {copied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep this URL private — anyone with it can view your bookings.
          </p>
        </div>

        {/* QR code */}
        {feedUrl && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-sm text-muted-foreground self-start">Or scan with your iPhone camera:</p>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <QRCode value={feedUrl} size={160} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Point iPhone Camera at the QR code → tap the banner → follow the prompts to subscribe
            </p>
          </div>
        )}

        {/* iPhone instructions */}
        <div className="rounded-lg border bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
            <Smartphone className="h-4 w-4" />
            How to add to iPhone Calendar
          </div>
          <ol className="text-sm text-blue-900 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Copy the subscription URL above</li>
            <li>Open the <strong>Settings</strong> app on your iPhone</li>
            <li>Scroll down and tap <strong>Calendar</strong></li>
            <li>Tap <strong>Accounts → Add Account → Other</strong></li>
            <li>Tap <strong>Add Subscribed Calendar</strong></li>
            <li>Paste the URL and tap <strong>Next</strong></li>
            <li>Tap <strong>Save</strong> — your bookings will appear in Calendar</li>
          </ol>
          <p className="text-xs text-blue-700 dark:text-blue-400 pt-1">
            Works the same way in Google Calendar (Other calendars → From URL) and macOS Calendar (File → New Calendar Subscription).
          </p>
        </div>

        <Separator />

        {/* Regenerate */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Reset subscription URL</p>
            <p className="text-xs text-muted-foreground">
              Generates a new URL and invalidates the old one. You'll need to re-add the calendar on all your devices.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending || isLoading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${regenerate.isPending ? "animate-spin" : ""}`} />
            {regenerate.isPending ? "Regenerating…" : "Reset URL"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Profile Panel ───────────────────────────────────────────────────────

export default function ProfilePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [changePassword, setChangePassword] = useState(false);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      changePassword: false,
      password: "",
      confirmPassword: ""
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (values: Partial<ProfileFormValues>) => {
      const data: any = {
        name: values.name,
        email: values.email
      };
      
      if (values.changePassword && values.password) {
        data.password = values.password;
      }

      if (!user) throw new Error("User not authenticated");
      
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
        variant: "default",
      });
      if (changePassword) {
        form.setValue("password", "");
        form.setValue("confirmPassword", "");
        form.setValue("changePassword", false);
        setChangePassword(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(values);
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>Update your personal information and password</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="change-password"
                  checked={changePassword}
                  onCheckedChange={(checked) => {
                    setChangePassword(checked);
                    form.setValue("changePassword", checked);
                  }}
                />
                <Label htmlFor="change-password">Change password</Label>
              </div>
              
              {changePassword && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="New password" {...field} />
                        </FormControl>
                        <FormDescription>
                          Minimum 6 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              <Button
                type="submit"
                className="w-full md:w-auto"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <CalendarSyncPanel />
    </div>
  );
}
