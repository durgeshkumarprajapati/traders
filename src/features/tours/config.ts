import type { Locale } from "@/features/i18n/types";

export interface LocalizedText {
  en: string;
  hi: string;
  gu: string;
}

export interface TourStep {
  id: string;
  target: string;
  route?: string;
  title: LocalizedText;
  description: LocalizedText;
  purpose: LocalizedText;
  instruction?: LocalizedText;
}

export interface TourDefinition {
  id: string;
  name: LocalizedText;
  steps: TourStep[];
}

export const TOUR_DEFINITIONS: TourDefinition[] = [
  {
    id: "welcome-overview",
    name: {
      en: "Website Quick Tour",
      hi: "वेबसाइट की त्वरित गाइड",
      gu: "વેબસાઇટની ઝડપી ગાઇડ",
    },
    steps: [
      {
        id: "welcome-nav",
        target: '[data-tour="main-nav"]',
        route: "/",
        title: {
          en: "Easy Navigation Menu",
          hi: "आसान नेविगेशन मेनू",
          gu: "સરળ નેવિગેશન મેનૂ",
        },
        description: {
          en: "Use this top menu to browse Products, open the Material Calculator, read our Knowledge Centre, or Track an Enquiry.",
          hi: "यहाँ से आप उत्पाद देख सकते हैं, कैलकुलेटर खोल सकते हैं, जानकारी पढ़ सकते हैं या अपनी पूछताछ ट्रैक कर सकते हैं।",
          gu: "અહીંથી તમે પ્રોડક્ટ્સ જોઈ શકો છો, કેલ્ક્યુલેટર ખોલી શકો છો, માહિતી વાંચી શકો છો અથવા પૂછપરછ ટ્રેક કરી શકો છો.",
        },
        purpose: {
          en: "Helps you jump directly to what you need without searching around.",
          hi: "आपको बिना भटके सीधे सही पेज पर ले जाता है।",
          gu: "તમને સીધા જ જરૂરી પેજ પર લઈ જાય છે.",
        },
      },
      {
        id: "welcome-products",
        target: '[data-tour="enquiry-list-link"]',
        route: "/",
        title: {
          en: "Your Material Enquiry List",
          hi: "आपकी सामग्री पूछताछ सूची",
          gu: "તમારી સામગ્રી પૂછપરછ યાદી",
        },
        description: {
          en: "Add multiple materials like cement, steel, and bricks to one list and request one combined quotation.",
          hi: "सीमेंट, सरिया और ईंट जैसी कई सामग्री को एक सूची में जोड़ें और एक साथ कोटेशन मँगवाएँ।",
          gu: "સિમેન્ટ, સળિયા અને ઈંટો જેવી સામગ્રી એક યાદીમાં ઉમેરો અને એક સાથે ભાવ મંગાવો.",
        },
        purpose: {
          en: "Saves time when you need prices for several items together.",
          hi: "एक साथ कई सामानों के भाव मँगवाने में समय बचाता है।",
          gu: "એકસાથે ઘણી વસ્તુઓના ભાવ મંગાવવામાં સમય બચાવે છે.",
        },
      },
      {
        id: "welcome-catalogue",
        target: '[data-tour="product-search"]',
        route: "/products",
        title: {
          en: "Search & Filter Materials",
          hi: "सामग्री खोजें और फ़िल्टर करें",
          gu: "સામગ્રી શોધો અને ફિલ્ટર કરો",
        },
        description: {
          en: "Type or use voice search in English, Hindi, or Gujarati (e.g. sariya, cement, eent) to find products quickly.",
          hi: "सामान का नाम लिखें या बोलकर खोजें (जैसे सीमेंट, सरिया, ईंट)।",
          gu: "સામગ્રીનું નામ લખો અથવા બોલીને શોધો (દા.ત. સિમેન્ટ, સળિયા, ઈંટો).",
        },
        purpose: {
          en: "Quickly locate exact brands, grades, and indicative rates.",
          hi: "सही ब्रांड और ताज़ा अनुमानित भाव तुरंत देखने के लिए।",
          gu: "યોગ્ય બ્રાન્ડ અને તાજા અંદાજિત ભાવ તરત જોવા માટે.",
        },
      },
      {
        id: "welcome-tools",
        target: '[data-tour="tools-entry"]',
        route: "/tools/cost-estimator",
        title: {
          en: "Project Cost & Material Estimator",
          hi: "प्रोजेक्ट लागत और सामग्री अनुमानक",
          gu: "પ્રોજેક્ટ ખર્ચ અને સામગ્રી અંદાજ",
        },
        description: {
          en: "Enter your room or wall measurements in feet to calculate approximate cement, bricks, sand, and steel.",
          hi: "फीट में अपने कमरे या दीवार का नाप डालें और अनुमानित सीमेंट, ईंट, रेत और सरिया जानें।",
          gu: "ફૂટમાં તમારા રૂમ કે દીવાલનું માપ નાખો અને અંદાજિત સિમેન્ટ, ઈંટો, રેતી અને સળિયા જાણો.",
        },
        purpose: {
          en: "Helps first-time home builders plan quantities before asking for a quote.",
          hi: "पहली बार घर बनाने वालों को मात्रा का अंदाज़ा लगाने में मदद करता है।",
          gu: "પ્રથમ વખત ઘર બનાવનારાઓને જથ્થાનો અંદાજ કાઢવામાં મદદ કરે છે.",
        },
      },
    ],
  },
];

export function pickText(text: LocalizedText, locale: Locale): string {
  return text[locale] || text.en;
}
