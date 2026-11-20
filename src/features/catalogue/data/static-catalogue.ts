import type { Brand, Category, Product } from "@/features/products/types";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { DEFAULT_BUSINESS_NAME } from "@/features/settings/business-settings";
import type { PublicCatalogue } from "../public";
import type { ViewCatalogue } from "../view";

/**
 * Static fallback catalogue categories.
 * Contains all six approved building materials categories.
 */
export const STATIC_CATEGORIES: Category[] = [
  {
    id: "cat-cement",
    slug: "cement",
    name: "Cement",
    description:
      "Ordinary Portland and Portland Pozzolana cement grades for foundations and structural work.",
    icon: "cement",
    displayOrder: 1,
    imageUrl: "/cement-materials.jpeg",
  },
  {
    id: "cat-steel",
    slug: "steel-tmt",
    name: "Steel & TMT",
    description:
      "High-yield strength Fe 550D and Fe 500D TMT reinforcement steel bars and structural binding wire.",
    icon: "steel",
    displayOrder: 2,
    imageUrl: "/tmt-steel.jpeg",
  },
  {
    id: "cat-bricks",
    slug: "bricks-blocks",
    name: "Bricks & Blocks",
    description:
      "Standard kiln-burnt red clay bricks, AAC lightweight aerated blocks, and fly ash bricks.",
    icon: "bricks",
    displayOrder: 3,
    imageUrl: "/bricks-blocks.jpeg",
  },
  {
    id: "cat-sand",
    slug: "sand-aggregates",
    name: "Sand & Aggregates",
    description:
      "Washed river sand, manufactured M-sand, plastering sand, and graded crushed stone aggregates.",
    icon: "sand",
    displayOrder: 4,
    imageUrl: null,
  },
  {
    id: "cat-hardware",
    slug: "hardware-plumbing",
    name: "Hardware & Plumbing",
    description:
      "UPVC/CPVC water supply pipes, drainage fittings, masonry binding wire, and construction hardware.",
    icon: "hardware",
    displayOrder: 5,
    imageUrl: "/hardware-supplies.jpeg",
  },
  {
    id: "cat-other",
    slug: "other-materials",
    name: "Other Materials",
    description:
      "Integral waterproofing liquid compounds, tile adhesives, construction joint mortars, and auxiliary supplies.",
    icon: "other",
    displayOrder: 6,
    imageUrl: null,
  },
];

/**
 * Static fallback catalogue brands.
 * Generic regional manufacturer representations without unverified official dealership claims.
 */
export const STATIC_BRANDS: Brand[] = [
  {
    id: "brand-buildpro",
    slug: "buildpro",
    name: "BuildPro Materials",
    logoUrl: null,
  },
  {
    id: "brand-durasteel",
    slug: "durasteel",
    name: "DuraSteel India",
    logoUrl: null,
  },
  {
    id: "brand-primemasonry",
    slug: "prime-masonry",
    name: "Prime Masonry",
    logoUrl: null,
  },
  {
    id: "brand-flowtech",
    slug: "flowtech",
    name: "FlowTech Pipes",
    logoUrl: null,
  },
  {
    id: "brand-ecobind",
    slug: "ecobind",
    name: "EcoBind Chemicals",
    logoUrl: null,
  },
  {
    id: "brand-generic",
    slug: "generic",
    name: "Standard / Regional Quarry",
    logoUrl: null,
  },
];

/**
 * Static fallback catalogue products.
 *
 * Rules:
 * - All 6 categories represented with realistic building materials.
 * - Zero fabricated prices: price is strictly null (displays "Rate on request").
 * - Zero fabricated availability: stockStatus is strictly "AVAILABLE_ON_ORDER".
 * - Zero fabricated SKUs: sku is null.
 * - Zero fabricated update timestamps: updatedAt is null.
 * - Preserves distinction between canonical TON and METRIC_TON.
 * - CUSTOM units include custom display labels.
 */
export const STATIC_PRODUCTS: Product[] = [
  // ── 1. Cement ─────────────────────────────────────────────────────────────
  {
    id: "static-cement-opc53",
    slug: "opc-53-grade-cement",
    name: "OPC 53 Grade Cement",
    sku: null,
    categoryId: "cat-cement",
    brandId: "brand-buildpro",
    description:
      "High-strength Ordinary Portland Cement 53 Grade conforming to IS 12269. Recommended for heavy-load RCC slabs, columns, beams, and high-rise structural foundations.",
    specifications: [
      { label: "Grade", value: "OPC 53 (IS 12269)" },
      { label: "Packaging", value: "50 kg HDPE Bag" },
      { label: "Setting Time", value: "Initial >= 30 min, Final <= 600 min" },
      { label: "Compressive Strength", value: "53 MPa at 28 days" },
    ],
    imageUrl: "/cement-materials.jpeg",
    price: null,
    unit: { code: "BAG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-cement-ppc",
    slug: "ppc-portland-pozzolana-cement",
    name: "PPC Portland Pozzana Cement",
    sku: null,
    categoryId: "cat-cement",
    brandId: "brand-buildpro",
    description:
      "Fly ash-based Portland Pozzolana Cement conforming to national structural specifications. Superior chemical resistance against sulfate and chloride attacks, ideal for plastering and general masonry.",
    specifications: [
      { label: "Grade", value: "PPC Grade" },
      { label: "Packaging", value: "50 kg HDPE Bag" },
      { label: "Application", value: "Brickwork, Plastering, Mass Concrete" },
    ],
    imageUrl: "/cement-materials.jpeg",
    price: null,
    unit: { code: "BAG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-cement-white",
    slug: "white-portland-cement",
    name: "White Portland Cement",
    sku: null,
    categoryId: "cat-cement",
    brandId: "brand-buildpro",
    description:
      "High-whiteness premium Portland cement for architectural plastering, tile grouting, terrazzo flooring, and decorative precast finishes.",
    specifications: [
      { label: "Grade", value: "White Cement (IS 8042)" },
      { label: "Packaging", value: "25 kg Bag" },
      { label: "Whiteness Index", value: ">= 88%" },
    ],
    imageUrl: "/cement-materials.jpeg",
    price: null,
    unit: { code: "BAG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },

  // ── 2. Steel & TMT ────────────────────────────────────────────────────────
  {
    id: "static-steel-tmt-10mm",
    slug: "fe-550d-tmt-steel-bars-10mm",
    name: "Fe 550D TMT Steel Rebar 10mm",
    sku: null,
    categoryId: "cat-steel",
    brandId: "brand-durasteel",
    description:
      "High-ductility Thermo-Mechanically Treated reinforcement steel bar (10mm diameter) conforming to IS 1786. Superior bendability and earthquake resistance for residential slabs.",
    specifications: [
      { label: "Grade", value: "Fe 550D (IS 1786)" },
      { label: "Diameter", value: "10 mm" },
      { label: "Standard Length", value: "12 meters" },
      { label: "Yield Strength", value: ">= 550 MPa" },
    ],
    imageUrl: "/tmt-steel.jpeg",
    price: null,
    unit: { code: "PIECE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-steel-tmt-12mm",
    slug: "fe-550d-tmt-steel-bars-12mm",
    name: "Fe 550D TMT Steel Rebar 12mm",
    sku: null,
    categoryId: "cat-steel",
    brandId: "brand-durasteel",
    description:
      "Structural Fe 550D TMT rebar (12mm diameter) for heavy structural load-bearing RCC columns and foundational plinths.",
    specifications: [
      { label: "Grade", value: "Fe 550D (IS 1786)" },
      { label: "Diameter", value: "12 mm" },
      { label: "Standard Length", value: "12 meters" },
    ],
    imageUrl: "/tmt-steel.jpeg",
    price: null,
    unit: { code: "PIECE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-steel-tmt-16mm",
    slug: "fe-550d-tmt-steel-bars-16mm",
    name: "Fe 550D TMT Steel Rebar 16mm",
    sku: null,
    categoryId: "cat-steel",
    brandId: "brand-durasteel",
    description:
      "Primary reinforcement Fe 550D TMT steel bar (16mm diameter) for heavy structural spans, column cores, and bridge construction.",
    specifications: [
      { label: "Grade", value: "Fe 550D (IS 1786)" },
      { label: "Diameter", value: "16 mm" },
      { label: "Standard Length", value: "12 meters" },
    ],
    imageUrl: "/tmt-steel.jpeg",
    price: null,
    unit: { code: "TON" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-steel-binding-wire",
    slug: "gi-annealed-binding-wire-18-gauge",
    name: "GI Annealed Binding Wire 18 Gauge",
    sku: null,
    categoryId: "cat-steel",
    brandId: "brand-durasteel",
    description:
      "Soft galvanized annealed binding wire for tying reinforcement rebar cages, stirrups, and beam links securely.",
    specifications: [
      { label: "Gauge", value: "18 SWG (1.2 mm)" },
      { label: "Material", value: "Galvanized Mild Steel" },
      { label: "Packaging", value: "Bundles / Rolls" },
    ],
    imageUrl: "/tmt-steel.jpeg",
    price: null,
    unit: { code: "KG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },

  // ── 3. Bricks & Blocks ────────────────────────────────────────────────────
  {
    id: "static-bricks-red-clay",
    slug: "standard-red-clay-kiln-bricks",
    name: "Standard Red Clay Kiln Bricks",
    sku: null,
    categoryId: "cat-bricks",
    brandId: "brand-primemasonry",
    description:
      "First-class kiln-burnt traditional red clay bricks conforming to IS 1077. High compressive load-bearing capability for exterior and interior perimeter masonry walls.",
    specifications: [
      { label: "Class", value: "First Class Kiln Burnt (IS 1077)" },
      { label: "Dimensions", value: "9 x 4.25 x 2.75 inches" },
      { label: "Water Absorption", value: "< 20% by weight" },
    ],
    imageUrl: "/bricks-blocks.jpeg",
    price: null,
    unit: { code: "PIECE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-bricks-aac-block-600",
    slug: "aac-autoclaved-aerated-concrete-blocks-600x200x150",
    name: "AAC Lightweight Concrete Blocks (600x200x150mm)",
    sku: null,
    categoryId: "cat-bricks",
    brandId: "brand-primemasonry",
    description:
      "Precision autoclaved aerated concrete blocks conforming to IS 2185 Part 3. Lightweight thermal-insulating building blocks providing structural dead-weight reduction and fast installation.",
    specifications: [
      { label: "Dimensions", value: "600 x 200 x 150 mm" },
      { label: "Density", value: "550 - 650 kg/m3" },
      { label: "Fire Resistance", value: "Up to 4 hours" },
    ],
    imageUrl: "/bricks-blocks.jpeg",
    price: null,
    unit: { code: "BLOCK" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-bricks-flyash",
    slug: "high-strength-fly-ash-bricks",
    name: "High-Strength Fly Ash Bricks",
    sku: null,
    categoryId: "cat-bricks",
    brandId: "brand-primemasonry",
    description:
      "Machine-pressed cement-fly ash mineral composite bricks. Smooth dimensional accuracy requiring less mortar plaster and zero efflorescence.",
    specifications: [
      { label: "Standard", value: "IS 12894" },
      { label: "Compressive Strength", value: ">= 7.5 MPa" },
      { label: "Dimensions", value: "230 x 110 x 75 mm" },
    ],
    imageUrl: "/bricks-blocks.jpeg",
    price: null,
    unit: { code: "PIECE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },

  // ── 4. Sand & Aggregates ──────────────────────────────────────────────────
  {
    id: "static-sand-river",
    slug: "washed-river-sand-for-concrete",
    name: "Washed River Sand for Concrete",
    sku: null,
    categoryId: "cat-sand",
    brandId: "brand-generic",
    description:
      "Double-washed natural coarse river sand free from organic silt, clay, and salts. Approved for concrete mixing, slab casting, and structural footings.",
    specifications: [
      { label: "Grading Zone", value: "Zone II (IS 383)" },
      { label: "Silt Content", value: "< 3% by volume" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "BRASS" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-sand-msand",
    slug: "manufactured-m-sand-concrete-grade",
    name: "Manufactured M-Sand (Concrete Grade)",
    sku: null,
    categoryId: "cat-sand",
    brandId: "brand-generic",
    description:
      "Crushed blue metal stone sand manufactured through VSI vertical shaft impactors conforming to IS 383 Zone II. Uniform particle distribution providing high concrete compressive strength.",
    specifications: [
      { label: "Standard", value: "IS 383 Zone II" },
      { label: "Fineness Modulus", value: "2.6 - 3.2" },
      { label: "Shape", value: "Cubical Cuboidal" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "BRASS" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-sand-agg-20mm",
    slug: "blue-metal-coarse-aggregates-20mm",
    name: "20mm Blue Metal Crushed Stone Aggregates",
    sku: null,
    categoryId: "cat-sand",
    brandId: "brand-generic",
    description:
      "Granite hard rock crushed stone aggregates graded at 20mm nominal size. Conforms to IS 383 for standard structural concrete works and foundations.",
    specifications: [
      { label: "Nominal Size", value: "20 mm Graded" },
      { label: "Rock Type", value: "Hard Blue Granite" },
      { label: "Flakiness Index", value: "< 15%" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "BRASS" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-sand-agg-10mm",
    slug: "blue-metal-crushed-aggregates-10mm",
    name: "10mm Blue Metal Crushed Stone Aggregates",
    sku: null,
    categoryId: "cat-sand",
    brandId: "brand-generic",
    description:
      "10mm crushed stone aggregates used in high-density thin-slab RCC concrete mix designs and precast block manufacturing.",
    specifications: [
      { label: "Nominal Size", value: "10 mm" },
      { label: "Specific Gravity", value: ">= 2.65" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "TON" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },

  // ── 5. Hardware & Plumbing ────────────────────────────────────────────────
  {
    id: "static-pipe-upvc-1inch",
    slug: "upvc-water-supply-pipe-1-inch",
    name: "UPVC Water Supply Pipe 1 Inch (Class 3)",
    sku: null,
    categoryId: "cat-hardware",
    brandId: "brand-flowtech",
    description:
      "Heavy-duty lead-free unplasticized PVC potable cold water plumbing pipe conforming to IS 4985. Non-corrosive with smooth internal bore reducing friction losses.",
    specifications: [
      { label: "Size", value: "1 Inch (25 mm)" },
      { label: "Standard", value: "IS 4985 Class 3 (6 kgf/cm2)" },
      { label: "Length", value: "3 meters / 6 meters" },
    ],
    imageUrl: "/hardware-supplies.jpeg",
    price: null,
    unit: { code: "METER" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-pipe-cpvc-075inch",
    slug: "cpvc-hot-cold-water-pipe-075-inch",
    name: "CPVC Hot & Cold Water Pipe 3/4 Inch (SDR 11)",
    sku: null,
    categoryId: "cat-hardware",
    brandId: "brand-flowtech",
    description:
      "Chlorinated Polyvinyl Chloride pipe conforming to IS 15778 SDR 11. Rated for continuous hot water circulation up to 93 degrees Celsius.",
    specifications: [
      { label: "Size", value: "3/4 Inch (20 mm)" },
      { label: "Rating", value: "SDR 11 (IS 15778)" },
      { label: "Temperature Rating", value: "Up to 93°C" },
    ],
    imageUrl: "/hardware-supplies.jpeg",
    price: null,
    unit: { code: "PIECE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-hardware-binding-wire-bundle",
    slug: "mild-steel-shuttering-wire-bundle",
    name: "Mild Steel Formwork Shuttering Wire (Bundle)",
    sku: null,
    categoryId: "cat-hardware",
    brandId: "brand-flowtech",
    description:
      "Annealed mild steel wire bundle for securing formwork shuttering plates and timber props during RCC casting.",
    specifications: [
      { label: "Packaging", value: "Coil Bundle" },
      { label: "Gauge", value: "16 SWG" },
    ],
    imageUrl: "/hardware-supplies.jpeg",
    price: null,
    unit: { code: "BUNDLE" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },

  // ── 6. Other Materials ────────────────────────────────────────────────────
  {
    id: "static-other-waterproof-liquid",
    slug: "integral-liquid-waterproofing-compound-20l",
    name: "Integral Liquid Waterproofing Compound (20L Can)",
    sku: null,
    categoryId: "cat-other",
    brandId: "brand-ecobind",
    description:
      "Specially formulated chloride-free integral liquid waterproofing admixture conforming to IS 2645. Reduces capillary water absorption in concrete and plaster.",
    specifications: [
      { label: "Standard", value: "IS 2645" },
      { label: "Dosage", value: "200 ml per 50 kg bag of cement" },
      { label: "Packaging", value: "20 Litre Drum" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "CUSTOM", customLabel: "20L Can" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: true,
    updatedAt: null,
  },
  {
    id: "static-other-tile-adhesive",
    slug: "polymer-modified-tile-adhesive-20kg",
    name: "Polymer-Modified Tile Adhesive 20kg",
    sku: null,
    categoryId: "cat-other",
    brandId: "brand-ecobind",
    description:
      "Factory-prepared cementitious polymer-modified tile adhesive conforming to IS 15477 Type 2. High bonding strength for ceramic and vitrified wall and floor tiles.",
    specifications: [
      { label: "Standard", value: "IS 15477 Type 2" },
      { label: "Bed Thickness", value: "3 - 6 mm" },
      { label: "Coverage", value: "approx. 45 - 55 sq.ft per 20 kg bag" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "BAG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
  {
    id: "static-other-grout-powder",
    slug: "non-shrink-structural-repair-grout",
    name: "High-Strength Non-Shrink Precision Grout",
    sku: null,
    categoryId: "cat-other",
    brandId: "brand-ecobind",
    description:
      "Free-flowing, non-shrink cementitious grout for anchoring heavy machinery baseplates, precast joint filling, and structural column grouting.",
    specifications: [
      { label: "Compressive Strength", value: ">= 60 MPa at 28 days" },
      { label: "Expansion", value: "Controlled non-shrink (0.2 - 2%)" },
      { label: "Packaging", value: "25 kg Bag" },
    ],
    imageUrl: null,
    price: null,
    unit: { code: "BAG" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    updatedAt: null,
  },
];

/**
 * Returns the resolved ViewCatalogue representation for static fallback.
 */
export function getStaticCatalogue(): ViewCatalogue {
  return {
    products: STATIC_PRODUCTS,
    categories: STATIC_CATEGORIES,
    brands: STATIC_BRANDS,
  };
}

/**
 * Returns the PublicCatalogue representation for static fallback.
 */
export function getStaticPublicCatalogue(): PublicCatalogue {
  return {
    products: STATIC_PRODUCTS.map((p) => ({
      ...p,
      isActive: true,
      createdAt: null,
    })),
    categories: STATIC_CATEGORIES.map((c) => ({
      ...c,
      isActive: true,
    })),
    brands: STATIC_BRANDS.map((b) => ({
      ...b,
      description: null,
      isActive: true,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Returns business settings for static fallback mode.
 * Preserves truthfulness: does not invent unverified telephone or address data.
 */
export function getStaticSettings(overrides?: Partial<BusinessSettings>): BusinessSettings {
  return {
    name: overrides?.name || DEFAULT_BUSINESS_NAME,
    tagline: overrides?.tagline || "Quality Building Materials & Hardware Supplies",
    phone: overrides?.phone || null,
    whatsappNumber: overrides?.whatsappNumber || null,
    email: overrides?.email || null,
    address: overrides?.address || null,
    businessHours: overrides?.businessHours || null,
    gstNumber: overrides?.gstNumber || null,
    googleMapsUrl: overrides?.googleMapsUrl || null,
    deliveryCoverage: overrides?.deliveryCoverage || null,
    announcement: overrides?.announcement || null,
    social: overrides?.social || {},
    whyChooseUs: overrides?.whyChooseUs?.length
      ? overrides.whyChooseUs
      : [
          {
            title: "Verified Building Materials",
            description:
              "Direct sourcing from established quarries, rolling mills, and cement manufacturers.",
          },
          {
            title: "Transparent Quotations",
            description:
              "Honest market rates and bulk contractor estimations tailored to project scale.",
          },
          {
            title: "Prompt Local Delivery",
            description: "Dedicated transport logistics across the regional construction corridor.",
          },
        ],
  };
}

/**
 * Looks up a static product by slug.
 */
export function findStaticProductBySlug(slug: string): Product | undefined {
  return STATIC_PRODUCTS.find((p) => p.slug === slug);
}

/**
 * Looks up a static product by ID.
 */
export function findStaticProductById(id: string): Product | undefined {
  return STATIC_PRODUCTS.find((p) => p.id === id);
}
