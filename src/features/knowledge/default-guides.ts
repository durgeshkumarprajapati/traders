import type { KnowledgeArticle } from "./types";

export const KNOWLEDGE_DISCLAIMER =
  "General educational guidance only. Every construction site has unique soil, load, and structural requirements — always confirm material grades and quantities with your structural engineer or contractor before ordering.";

/**
 * Built-in plain-language educational articles for homeowners and first-time builders.
 * Administrators can also publish additional articles from /admin/knowledge.
 */
export const DEFAULT_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "builtin-cement-opc-vs-ppc",
    title: "Cement Types Explained: OPC vs PPC for Home Construction",
    slug: "cement-types-opc-vs-ppc",
    category: "Cement",
    tags: ["cement", "opc", "ppc", "home-building"],
    summary:
      "Understand the practical difference between OPC (Ordinary Portland Cement) and PPC (Portland Pozzolana Cement) in simple terms.",
    body:
      "When building a house, you will commonly hear two terms: OPC and PPC.\n\n1. PPC (Portland Pozzolana Cement): Widely used for brickwork, plastering, flooring, and general residential RCC work. It generates less heat while setting and offers good long-term durability.\n\n2. OPC (Ordinary Portland Cement, such as 43 or 53 Grade): Gains strength faster in the early days, which is why contractors often choose it when rapid shuttering removal or high-early-strength RCC work is planned.\n\nTip: Check the manufacturing week printed on every cement bag and keep bags raised off the floor in a dry covered area.",
    translations: {
      hi: {
        title: "सीमेंट के प्रकार: घर बनाने के लिए OPC और PPC में अंतर",
        summary: "आसान भाषा में समझें कि OPC और PPC सीमेंट में क्या अंतर है और किस काम में कौन-सा उपयोग होता है।",
        body:
          "घर बनाते समय आमतौर पर दो तरह के सीमेंट की बात होती है: OPC और PPC।\n\n1. PPC सीमेंट: चिनाई, प्लास्टर, फर्श और सामान्य घर निर्माण के लिए बहुत उपयोगी है।\n2. OPC सीमेंट (43 या 53 ग्रेड): शुरुआती दिनों में जल्दी मजबूती पकड़ता है, इसलिए तेज़ शटरिंग या विशेष RCC कामों में ठेकेदार इसे चुनते हैं।\n\nसलाह: हमेशा अपने इंजीनियर या मिस्त्री की सलाह से सही ग्रेड चुनें और सीमेंट को सूखी जगह पर रखें।",
      },
      gu: {
        title: "સિમેન્ટના પ્રકારો: ઘરના બાંધકામ માટે OPC અને PPC વચ્ચેનો તફાવત",
        summary: "સરળ ભાષામાં સમજો કે OPC અને PPC સિમેન્ટમાં શું તફાવત છે અને કયા કામમાં કયો સિમેન્ટ વપરાય છે.",
        body:
          "ઘર બનાવતી વખતે સામાન્ય રીતે OPC અને PPC સિમેન્ટની વાત થાય છે.\n\n1. PPC સિમેન્ટ: ચણતર, પ્લાસ્ટર, ફ્લોરિંગ અને સામાન્ય રહેણાંક બાંધકામ માટે ઉપયોગી છે.\n2. OPC સિમેન્ટ (43 અથવા 53 ગ્રેડ): શરૂઆતના દિવસોમાં ઝડપી મજબૂતી આપે છે.\n\nટિપ: હંમેશા તમારા એન્જિનિયર અથવા કોન્ટ્રાક્ટરની સલાહ મુજબ ગ્રેડ પસંદ કરો અને સિમેન્ટને સૂકી જગ્યાએ રાખો.",
      },
    },
    relatedProductSlugs: [],
    technicalReviewed: true,
    status: "PUBLISHED",
    publishedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "builtin-bricks-vs-aac-blocks",
    title: "Red Clay Bricks vs AAC Lightweight Blocks: How to Choose",
    slug: "bricks-vs-aac-blocks",
    category: "Bricks & Blocks",
    tags: ["bricks", "aac-blocks", "walls"],
    summary:
      "Compare traditional clay bricks and AAC blocks on weight, speed of wall work, and mortar usage.",
    body:
      "Walls can be built using traditional red clay bricks or AAC (Autoclaved Aerated Concrete) blocks.\n\n1. Red Clay Bricks: Familiar to almost every local mason, strong for standard load-bearing and partition walls.\n2. AAC Blocks: Larger in size and much lighter in weight, which can reduce dead load on beams and speed up wall masonry with thinner joints.\n\nAsk your engineer which option matches your structural design, and send your wall measurements to Sagar Traders for a rate comparison.",
    translations: {
      hi: {
        title: "लाल ईंट बनाम AAC ब्लॉक: दीवार के लिए क्या चुनें?",
        summary: "वजन, काम की गति और मसाले की खपत के आधार पर लाल ईंट और AAC ब्लॉक की तुलना।",
        body:
          "दीवार बनाने के लिए पारंपरिक लाल ईंट या AAC ब्लॉक का उपयोग किया जाता है।\n\n1. लाल ईंट: हर मिस्त्री इसके काम से परिचित होता है और यह मजबूत होती है।\n2. AAC ब्लॉक: आकार में बड़े और वजन में हल्के होते हैं, जिससे दीवार जल्दी बनती है।\n\nअपने इंजीनियर की सलाह के अनुसार सही विकल्प चुनें।",
      },
      gu: {
        title: "લાલ ઈંટો વિરુદ્ધ AAC બ્લોક્સ: દીવાલ માટે શું પસંદ કરવું?",
        summary: "વજન, કામની ઝડપ અને સિમેન્ટના વપરાશના આધારે લાલ ઈંટો અને AAC બ્લોક્સની સરખામણી.",
        body:
          "દીવાલ બનાવવા માટે પરંપરાગત લાલ ઈંટો અથવા AAC બ્લોક્સનો ઉપયોગ થાય છે.\n\n1. લાલ ઈંટો: દરેક કડિયા માટે પરિચિત અને મજબૂત વિકલ્પ છે.\n2. AAC બ્લોક્સ: કદમાં મોટા અને વજનમાં હલકા હોય છે, જેથી ચણતર ઝડપથી થાય છે.\n\nતમારા એન્જિનિયરની સલાહ મુજબ યોગ્ય પસંદગી કરો.",
      },
    },
    relatedProductSlugs: [],
    technicalReviewed: true,
    status: "PUBLISHED",
    publishedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "builtin-tmt-steel-selection",
    title: "How to Select TMT Steel Bars for Your House",
    slug: "how-to-select-tmt-steel",
    category: "TMT Steel",
    tags: ["tmt", "steel", "rebar"],
    summary:
      "Understand TMT steel diameters (8mm, 10mm, 12mm, 16mm) and why structural drawings specify different grades.",
    body:
      "TMT (Thermo-Mechanically Treated) steel bars reinforce concrete columns, beams, and slabs.\n\n1. Diameters: Thin bars (8mm) are commonly used for stirrups/rings and slabs, while thicker bars (10mm, 12mm, 16mm+) are used in beams and columns as specified by your structural drawing.\n2. Grades (e.g. Fe 500D / Fe 550D): Follow the exact grade specified by your engineer.\n3. Storage: Keep steel bars off wet soil and cover them during rain to avoid heavy surface rust.",
    translations: {},
    relatedProductSlugs: [],
    technicalReviewed: true,
    status: "PUBLISHED",
    publishedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "builtin-material-storage-guide",
    title: "How to Store Cement, Steel, and Sand Safely at Site",
    slug: "material-storage-at-site",
    category: "Storage & Handling",
    tags: ["storage", "cement", "steel", "site-tips"],
    summary:
      "Simple site storage practices to protect building materials from moisture and wastage.",
    body:
      "Good storage prevents costly material damage on site:\n\n1. Cement: Stack on wooden planks or dry sheets at least 15 cm above the floor, away from damp walls, and use older bags first (First-In, First-Out).\n2. Steel: Keep stacked by diameter on raised supports and covered with tarpaulin during monsoon.\n3. Sand & Aggregates: Store on a clean, firm surface separated from soil or mud.",
    translations: {},
    relatedProductSlugs: [],
    technicalReviewed: true,
    status: "PUBLISHED",
    publishedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
];
