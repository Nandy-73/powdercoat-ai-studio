export type Role =
  | "administrator"
  | "senior_rd_manager"
  | "rd_engineer"
  | "color_matching_engineer"
  | "production_manager"
  | "qc_engineer"
  | "procurement_manager"
  | "sales_manager"
  | "viewer";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export type MaterialCategory =
  | "resin"
  | "hardener"
  | "pigment"
  | "filler"
  | "flow_agent"
  | "benzoin"
  | "degassing_agent"
  | "texture_additive"
  | "special_additive"
  | "wax";

export interface Material {
  id: number;
  name: string;
  code: string;
  category: MaterialCategory;
  chemical_family: string;
  function: string;
  density_g_cm3: number;
  cost_per_kg: number;
  currency: string;
  supplier_name: string;
  country: string;
  safety_info: string;
  tds_url: string;
  sds_url: string;
  specs: string;
}

export type ChemistrySystem = "epoxy" | "polyester" | "hybrid" | "polyurethane" | "acrylic" | "custom";
export type FormulationStatus = "draft" | "trial" | "approved" | "production" | "rejected" | "archived";

export interface FormulationItem {
  id: number;
  material_id: number;
  weight_kg: number;
  material: Material;
}

export interface Formulation {
  id: number;
  name: string;
  code: string;
  system: ChemistrySystem;
  status: FormulationStatus;
  description: string;
  target_finish: string;
  target_gloss: number;
  cure_temp_c: number;
  cure_time_min: number;
  created_at: string;
  updated_at: string;
  items: FormulationItem[];
}

export interface FormulationMetrics {
  total_weight_kg: number;
  cost_per_kg: number;
  total_cost: number;
  resin_pct: number;
  hardener_pct: number;
  pigment_pct: number;
  filler_pct: number;
  additive_pct: number;
  binder_content_pct: number;
  resin_to_hardener_ratio: number | null;
  pigment_loading_pct: number;
  pvc_pct: number;
  composition: { name: string; category: string; weight_kg: number; pct: number; cost: number }[];
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  explanation: string;
  correction: string;
}

export interface ValidationReport {
  metrics: FormulationMetrics;
  issues: ValidationIssue[];
  score: number;
  verdict: string;
}

export interface ColorBlock {
  rgb: { r: number; g: number; b: number };
  hex: string;
  lab: { l: number; a: number; b: number };
}

export interface ColorAnalysis {
  target: ColorBlock;
  actual: ColorBlock;
  delta_e_2000: number;
  delta_l: number;
  delta_a: number;
  delta_b: number;
  delta_chroma: number;
  verdict: string;
  pass: boolean;
  issues: { direction: string; diagnosis: string; cause: string; action: string }[];
  corrections: { pigment: string; adjustment_pct_relative: number; action: string; reason: string }[];
  ral_estimate_target?: { code: string; name: string; hex: string; delta_e: number } | null;
  ral_estimate_actual?: { code: string; name: string; hex: string; delta_e: number } | null;
  record_id?: number;
}

export interface FinishPrediction {
  gloss_60deg: number;
  gloss_category: string;
  finish_type: string;
  finish_probabilities: Record<string, number>;
  film_appearance: string;
}

export interface PropertyScore {
  score: number;
  rating: string;
  estimate?: string;
}

export interface MechanicalPrediction {
  hardness: PropertyScore;
  adhesion: PropertyScore;
  flexibility: PropertyScore;
  impact_resistance: PropertyScore;
  chemical_resistance: PropertyScore;
  weather_resistance: PropertyScore;
  salt_spray_resistance: PropertyScore;
  humidity_resistance: PropertyScore;
  outdoor_durability: PropertyScore;
}

export interface ManufacturingPrediction {
  extrusion_behavior: { load_pct: number; assessment: string };
  cooling_efficiency: { score: number; note: string };
  grinding_efficiency: { score: number; note: string };
  particle_size_d50_um: number;
  sprayability: { score: number; note: string };
  transfer_efficiency_pct: number;
  recommended_film_thickness_um: string;
  recommended_cure_schedule: string;
  production_risks: string[];
}

export interface OptimizationResult {
  baseline: Record<string, number>;
  optimized: Record<string, number | string>;
  changes: { material: string; from_pct: number; to_pct: number; direction: string }[];
  optimized_items: { name: string; material_id: number | null; weight_kg: number; pct: number }[];
  iterations: number;
  error?: string;
}

export interface Supplier {
  id: number;
  company: string;
  country: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  certifications: string;
  distributor_info: string;
  rating: number;
  lead_time_days: number;
  products: { id: number; product_name: string; category: string; price_per_kg: number; currency: string; moq_kg: number }[];
}

export interface Machine {
  id: number;
  name: string;
  machine_type: string;
  manufacturer: string;
  country: string;
  capacity: string;
  estimated_price_usd: number;
  energy_kw: number;
  warranty_years: number;
  specs: string;
}

export interface IngestionSource {
  id: number;
  name: string;
  url: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string;
}

export interface MachineSuggestion {
  id: number;
  name: string;
  machine_type: string;
  manufacturer: string;
  country: string;
  capacity: string;
  estimated_price_usd: number;
  energy_kw: number;
  source_name: string;
  source_url: string;
  excerpt: string;
  confidence: number;
  method: string;
  status: string;
  created_at: string;
}

export interface IngestRunResult {
  sources_scanned: number;
  new_suggestions: number;
  details: string[];
}

export interface MarketInsight {
  id: number;
  category: string;
  title: string;
  summary: string;
  impact: "low" | "medium" | "high";
  region: string;
  published_at: string;
}

export interface Batch {
  id: number;
  batch_number: string;
  formulation_id: number;
  size_kg: number;
  scale: string;
  status: string;
  cost_total: number;
  created_at: string;
  qc_records: QCRecord[];
}

export interface QCRecord {
  id: number;
  batch_id: number;
  test_name: string;
  value: number | null;
  unit: string;
  result: string;
  notes: string;
  created_at: string;
}

export interface PriceBenchmark {
  id: number;
  material_name: string;
  category: string;
  country: string;
  price_per_kg: number;
  currency: string;
  quality_score: number;
  delivery_days: number;
  supplier_rating: number;
  import_available: number;
}

export interface CountryRank {
  rank: number;
  country: string;
  material: string;
  price_per_kg: number;
  currency: string;
  quality_score: number;
  delivery_days: number;
  supplier_rating: number;
  import_available: boolean;
  overall_score: number;
}

export interface DashboardSummary {
  kpis: {
    active_formulations: number;
    approved_formulations: number;
    total_formulations: number;
    production_batches: number;
    batches_in_progress: number;
    failed_trials: number;
    passed_trials: number;
    trial_success_rate: number;
    materials: number;
    suppliers: number;
    qc_pass_rate: number | null;
    avg_cost_per_kg: number;
  };
  cost_by_formulation: { name: string; cost_per_kg: number; system: string }[];
  systems_distribution: { name: string; value: number }[];
  status_distribution: { name: string; value: number }[];
  batch_status_distribution: { name: string; value: number }[];
  color_trend: { id: number; delta_e: number; target_hex: string; actual_hex: string; date: string }[];
  material_consumption: { category: string; kg: number }[];
}

export interface AssistantResponse {
  intent: string;
  answer: string;
  optimization?: OptimizationResult;
  alternatives?: CostAlternative[];
  analysis?: ColorAnalysis;
  validation?: ValidationReport;
  cost?: CostBreakdown;
  formulation?: { basis: string; items: { name: string; category: string; weight_kg: number; pct: number }[] };
}

export interface CostAlternative {
  replace: string;
  with: string;
  category: string;
  current_cost_per_kg: number;
  alternative_cost_per_kg: number;
  saving_per_kg_of_material: number;
  estimated_formulation_saving_per_kg: number;
  same_chemical_family: boolean;
  risk: string;
}

export interface CostBreakdown {
  batch_kg: number;
  material_cost: number;
  material_cost_per_kg: number;
  overhead_pct: number;
  production_cost: number;
  production_cost_per_kg: number;
  lines: { material: string; category: string; weight_kg: number; pct: number; cost: number }[];
  selling_price_per_kg?: number;
  revenue?: number;
  profit?: number;
  margin_pct?: number;
  alternatives?: CostAlternative[];
}

export interface Trial {
  id: number;
  formulation_id: number;
  result: string;
  gloss_measured: number | null;
  notes: string;
  created_at: string;
}

export interface SimilarFormulation {
  id: number;
  name: string;
  code: string;
  system: string;
  status: string;
  similarity_pct: number;
  cost_per_kg: number;
}
