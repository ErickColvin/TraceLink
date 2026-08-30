import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { UpdateOrganizationSettingsInput } from "../domain";
import { settingsService } from "../services";

export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => [...settingsKeys.all, "organization"] as const,
};

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: () => settingsService.get(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrganizationSettingsInput) => settingsService.update(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKeys.detail(), settings);
    },
  });
}
