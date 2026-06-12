import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import SiteManagerInviteForm from "@/components/user/SiteManagerInviteForm";

export default function SiteManagerUserPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Fetch only users with producer role
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users/producers"],
    enabled: user?.role === "site_manager",
  });

  // Format role for display
  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Get role color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-300";
      case "producer":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "engineer":
        return "bg-green-100 text-green-800 border-green-300";
      case "it":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "site_manager":
        return "bg-amber-100 text-amber-800 border-amber-300";
      default:
        return "bg-gray-100 text-neutral-800 border-gray-300";
    }
  };

  if (user?.role !== "site_manager") {
    return (
      <div className="flex flex-col h-screen">
        <Header
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          view="week"
          onViewChange={() => {}}
          title="Producer Management"
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
                You don't have permission to access this page. Only site managers can access the Producer Management page.
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
        title="Producer Management"
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Producer Management</h1>
          <SiteManagerInviteForm />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Producers</CardTitle>
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
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">
                          No producers found. Use the "Invite Producer" button to add new producers.
                        </td>
                      </tr>
                    ) : (
                      users.map(userData => (
                        <tr key={userData.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{userData.name}</td>
                          <td className="py-3 px-4">{userData.username}</td>
                          <td className="py-3 px-4">{userData.email}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={getRoleBadgeColor(userData.role)}>
                              {formatRole(userData.role)}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}