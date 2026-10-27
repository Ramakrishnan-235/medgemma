import { useQuery } from "@tanstack/react-query";

export interface SystemHealthResponse {
  status: string;
  service: string;
  mode: string;
  checkpoint: string;
}

export function useSystemHealth() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return useQuery<SystemHealthResponse>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/health`);
      if (!res.ok) {
        throw new Error(`Health check failed with status: ${res.status}`);
      }
      return await res.json();
    },
    refetchInterval: 30000,
  });
}
