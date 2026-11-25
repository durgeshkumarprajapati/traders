"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/features/i18n/store";
import { tourStore } from "@/features/tours/store";

export type HelpTopic = "calculator" | "bulk-enquiry" | "quotation" | "order-tracking";

const HELP_CONTENT: Record<
  HelpTopic,
  {
    question: Record<"en" | "hi" | "gu", string>;
    whatIsIt: Record<"en" | "hi" | "gu", string>;
    steps: Record<"en" | "hi" | "gu", string[]>;
  }
> = {
  calculator: {
    question: {
      en: "What does this calculator do?",
      hi: "यह कैलकुलेटर क्या करता है?",
      gu: "આ કેલ્ક્યુલેટર શું કરે છે?",
    },
    whatIsIt: {
      en: "It helps you estimate approximately how much cement, bricks, sand, or steel you may need based on your measurements.",
      hi: "यह आपके नाप के आधार पर अनुमानित सीमेंट, ईंट, रेत या सरिया की मात्रा निकालने में मदद करता है।",
      gu: "તે તમારા માપ મુજબ અંદાજિત સિમેન્ટ, ઈંટો, રેતી કે સળિયાનો જથ્થો કાઢવામાં મદદ કરે છે.",
    },
    steps: {
      en: [
        "Choose what you are building (room, wall, or floor).",
        "Enter your measurements in feet.",
        "Review the approximate quantities and send the list to Sagar Traders for verification.",
      ],
      hi: [
        "चुनें कि आप क्या बना रहे हैं (कमरा, दीवार या फर्श)।",
        "फीट में अपना नाप डालें।",
        "अनुमानित मात्रा देखें और जांच के लिए सागर ट्रेडर्स को भेजें।",
      ],
      gu: [
        "તમે શું બનાવી રહ્યા છો તે પસંદ કરો (રૂમ, દીવાલ કે ફ્લોર).",
        "ફૂટમાં તમારું માપ નાખો.",
        "અંદાજિત જથ્થો જુઓ અને ચકાસણી માટે સાગર ટ્રેડર્સને મોકલો.",
      ],
    },
  },
  "bulk-enquiry": {
    question: {
      en: "What is a bulk enquiry?",
      hi: "बल्क पूछताछ क्या है?",
      gu: "બલ્ક પૂછપરછ શું છે?",
    },
    whatIsIt: {
      en: "If you need several materials together, you can add all of them to one list and send one enquiry to Sagar Traders for a combined price offer.",
      hi: "यदि आपको कई निर्माण सामग्री एक साथ चाहिए, तो आप सबको एक सूची में जोड़कर एक ही पूछताछ में भाव मँगवा सकते हैं।",
      gu: "જો તમને એકસાથે ઘણી સામગ્રી જોઈતી હોય, તો બધી એક યાદીમાં ઉમેરીને એક સાથે ભાવ મંગાવી શકો છો.",
    },
    steps: {
      en: [
        "Add the materials and quantities you need.",
        "Enter your name, mobile number, and delivery location.",
        "Submit to get a tracking reference while our team prepares your quotation.",
      ],
      hi: [
        "अपनी ज़रूरी सामग्री और मात्रा जोड़ें।",
        "अपना नाम, मोबाइल नंबर और डिलीवरी का स्थान लिखें।",
        "सबमिट करें और ट्रैकिंग नंबर प्राप्त करें।",
      ],
      gu: [
        "તમને જોઈતી સામગ્રી અને જથ્થો ઉમેરો.",
        "તમારું નામ, મોબાઇલ નંબર અને ડિલિવરી સ્થળ લખો.",
        "સબમિટ કરો અને ટ્રેકિંગ નંબર મેળવો.",
      ],
    },
  },
  quotation: {
    question: {
      en: "What is a quotation?",
      hi: "कोटेशन क्या होता है?",
      gu: "ક્વોટેશન શું છે?",
    },
    whatIsIt: {
      en: "A quotation is an official price offer from Sagar Traders for the materials you requested. You can review rates, download the PDF, and accept or request changes online.",
      hi: "कोटेशन सागर ट्रेडर्स द्वारा आपकी मांगी गई सामग्री के लिए भेजा गया पक्का भाव प्रस्ताव है। आप इसे ऑनलाइन स्वीकार कर सकते हैं या बदलाव पूछ सकते हैं।",
      gu: "ક્વોટેશન એ સાગર ટ્રેડર્સ દ્વારા તમારી પૂછપરછ માટે આપેલ ભાવની ઓફર છે. તમે તેને ઓનલાઇન સ્વીકારી શકો છો અથવા ફેરફાર કહી શકો છો.",
    },
    steps: {
      en: [
        "Check each material, quantity, and rate.",
        "Download the PDF if you want to save or share it.",
        "Click Accept Quotation or Request Changes.",
      ],
      hi: [
        "हर सामग्री, मात्रा और भाव जांचें।",
        "PDF डाउनलोड करके सेव करें।",
        "कोटेशन स्वीकार करें या बदलाव का अनुरोध करें।",
      ],
      gu: [
        "દરેક સામગ્રી, જથ્થો અને ભાવ તપાસો.",
        "PDF ડાઉનલોડ કરી શકો છો.",
        "ક્વોટેશન સ્વીકારો અથવા ફેરફાર માટે જણાવો.",
      ],
    },
  },
  "order-tracking": {
    question: {
      en: "How does order tracking work?",
      hi: "ऑर्डर ट्रैकिंग कैसे काम करती है?",
      gu: "ઓર્ડર ટ્રેકિંગ કેવી રીતે કામ કરે છે?",
    },
    whatIsIt: {
      en: "Use your private tracking link to see whether your order is confirmed, being packed, dispatched, or delivered.",
      hi: "अपने निजी ट्रैकिंग लिंक से देखें कि आपका ऑर्डर कन्फर्म हुआ है, पैक हो रहा है, निकल चुका है या डिलीवर हो गया है।",
      gu: "તમારી પ્રાઇવેટ ટ્રેકિંગ લિંકથી જુઓ કે તમારો ઓર્ડર કન્ફર્મ થયો છે, પેક થઈ રહ્યો છે, નીકળી ગયો છે કે ડિલિવર થયો છે.",
    },
    steps: {
      en: [
        "Open the secure tracking link shared by Sagar Traders.",
        "View the current stage and expected delivery date.",
        "Confirm delivery once received, or report any issue directly.",
      ],
      hi: [
        "सागर ट्रेडर्स द्वारा भेजा गया ट्रैकिंग लिंक खोलें।",
        "मौजूदा स्थिति और डिलीवरी की तारीख देखें।",
        "सामान मिलने पर डिलीवरी कन्फर्म करें या कोई समस्या हो तो रिपोर्ट करें।",
      ],
      gu: [
        "સાગર ટ્રેડર્સે મોકલેલી ટ્રેકિંગ લિંક ખોલો.",
        "હાલની સ્થિતિ અને ડિલિવરીની તારીખ જુઓ.",
        "માલ મળ્યા પછી ડિલિવરી કન્ફર્મ કરો અથવા કોઈ સમસ્યા હોય તો જણાવો.",
      ],
    },
  },
};

export function ContextualHelp({ topic }: { topic: HelpTopic }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const content = HELP_CONTENT[topic];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-label-md font-semibold text-primary hover:underline"
      >
        <HelpCircle aria-hidden className="size-4" />
        <span>{content.question[locale]}</span>
      </button>
      {open && (
        <Card className="border border-info/30 bg-surface-muted p-gutter-md space-y-2 text-body-sm">
          <p className="text-on-surface">{content.whatIsIt[locale]}</p>
          <ol className="list-decimal pl-5 space-y-1 text-on-surface-variant">
            {content.steps[locale].map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => tourStore.start("welcome-overview")}
          >
            Take Guided Tour
          </Button>
        </Card>
      )}
    </div>
  );
}
