import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/lib/api/client";
import { auth } from "@/lib/api/endpoints";
import type { Me } from "@/lib/api/types";

export const ME_KEY = ["me"] as const;

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await auth.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useSignOut(redirectTo: string) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: auth.logout,
    onSettled: () => {
      client.clear();
      navigate(redirectTo, { replace: true });
    },
  });
}
