export interface WcProductRaw {
  id: number;
  name: string;
  description: string;
  price: string;
  status: string;
}

export interface MappedWcProduct {
  wcId: number;
  sku: string;
  name: string;
  design: string | null;
  unitPrice: number;
}

/** WooCommerce product titles are literal shade/design codes, e.g. "HPLMAKER 9007" — there is
 * no separate "shade name" field on the source, so sku is the trailing numeric code and name is
 * kept verbatim (confirmed with the business owner rather than inventing a "prettier" name). */
export function parseProductCode(name: string): string {
  const match = name.match(/(\d+)\s*$/);
  return match ? match[1] : name.trim();
}

/** Light keyword heuristic over the marketing description, mapped onto the same free-text
 * design vocabulary seed.ts already uses for fabricated products ("Wood Grain", "Marble
 * Finish", etc.) so synced and fabricated rows read consistently in the UI. Best-effort only —
 * WooCommerce has no structured "design" field to read from directly. */
export function deriveDesign(description: string): string | null {
  const text = description.toLowerCase();
  if (text.includes("marble")) return "Marble Finish";
  if (text.includes("wood") || text.includes("grain")) return "Wood Grain";
  if (text.includes("stone")) return "Stone Finish";
  if (text.includes("matte")) return "Solid Matte";
  if (text.includes("gloss")) return "Solid Gloss";
  if (text.includes("metallic")) return "Solid Metallic";
  return null;
}

export function mapWcProduct(raw: WcProductRaw): MappedWcProduct {
  return {
    wcId: raw.id,
    sku: parseProductCode(raw.name),
    name: raw.name.trim(),
    design: deriveDesign(raw.description ?? ""),
    unitPrice: Number(raw.price),
  };
}
