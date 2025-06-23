import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // CRITICAL DEBUG: Log booking creation requests
  if (data && url.includes('/api/bookings') && method === 'POST') {
    console.log("[apiRequest] CRITICAL - Booking creation request:", {
      url,
      method,
      dataKeys: data ? Object.keys(data as any) : [],
      studioIds: (data as any)?.studioIds,
      studioIdsType: typeof (data as any)?.studioIds,
      studioIdsLength: (data as any)?.studioIds?.length,
      dataStringified: JSON.stringify(data)
    });
  }

  const requestBody = data ? JSON.stringify(data) : undefined;
  
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    console.log("[apiRequest] ===== FINAL REQUEST BODY =====");
    console.log("[apiRequest] Final request body string:", requestBody);
    console.log("[apiRequest] Request body contains studioIds?:", requestBody?.includes('studioIds'));
    console.log("[apiRequest] Request body studioIds value:", requestBody?.match(/"studioIds":\[[^\]]*\]/)?.[0]);
  }

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: requestBody,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Enable refetching on window focus
      staleTime: 30000, // Change from Infinity to 30 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
