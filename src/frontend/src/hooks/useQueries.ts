import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Annotation, LivePrice } from "../backend.d";
import { useActor } from "./useActor";

export function useStats() {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getStats();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSeedData() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      await actor.seedData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
  });
}

export function useAnnotations(start: number, end: number) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["annotations", start, end],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAnnotations(BigInt(start), BigInt(end));
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddAnnotation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (annotation: Annotation) => {
      if (!actor) throw new Error("No actor");
      await actor.addAnnotation(annotation);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

export function useDeleteAnnotation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("No actor");
      await actor.deleteAnnotation(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
  });
}

export function useUpdateAnnotation() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updated,
    }: {
      id: string;
      updated: Annotation;
    }) => {
      if (!actor) throw new Error("No actor");
      await actor.updateAnnotation(id, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
    },
  });
}

export function useLiveMarketSnapshot() {
  const { actor, isFetching } = useActor();
  return useQuery<Map<string, LivePrice>>({
    queryKey: ["liveSnapshot"],
    queryFn: async () => {
      if (!actor) return new Map<string, LivePrice>();
      const arr = await actor.getLiveMarketSnapshot();
      const map = new Map<string, LivePrice>();
      for (const item of arr) {
        map.set(item.marketId, item);
      }
      return map;
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 60_000,
  });
}

export function useLastFetchTime() {
  const { actor, isFetching } = useActor();
  return useQuery<bigint>({
    queryKey: ["lastFetchTime"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getLastFetchTime();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 60_000,
  });
}

export function useFetchLiveMarketData() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      await actor.fetchLiveMarketData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liveSnapshot"] });
      queryClient.invalidateQueries({ queryKey: ["lastFetchTime"] });
    },
  });
}

export function useComputeCorrelation(
  marketId: string,
  astroId: string,
  start: number,
  end: number,
) {
  const { actor, isFetching } = useActor();
  return useQuery({
    queryKey: ["correlation", marketId, astroId, start, end],
    queryFn: async () => {
      if (!actor) return null;
      return actor.computeCorrelation(
        marketId,
        astroId,
        BigInt(start),
        BigInt(end),
      );
    },
    enabled: !!actor && !isFetching && !!marketId && !!astroId,
  });
}
