import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Formulation, Material } from "./types";

export function useFormulations(search?: string) {
  return useQuery({
    queryKey: ["formulations", search ?? ""],
    queryFn: () =>
      api.get<Formulation[]>(`/formulations${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useFormulation(id: number | null) {
  return useQuery({
    queryKey: ["formulation", id],
    queryFn: () => api.get<Formulation>(`/formulations/${id}`),
    enabled: id != null,
  });
}

export function useMaterials(category?: string, search?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search) params.set("search", search);
  const qs = params.toString();
  return useQuery({
    queryKey: ["materials", category ?? "", search ?? ""],
    queryFn: () => api.get<Material[]>(`/materials${qs ? `?${qs}` : ""}`),
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  resin: "Resin",
  hardener: "Hardener",
  pigment: "Pigment",
  filler: "Filler",
  flow_agent: "Flow Agent",
  benzoin: "Benzoin",
  degassing_agent: "Degassing Agent",
  texture_additive: "Texture Additive",
  special_additive: "Special Additive",
  wax: "Wax",
};

export const SYSTEM_LABELS: Record<string, string> = {
  epoxy: "Epoxy",
  polyester: "Polyester",
  hybrid: "Hybrid",
  polyurethane: "Polyurethane",
  acrylic: "Acrylic",
  custom: "Custom",
};

