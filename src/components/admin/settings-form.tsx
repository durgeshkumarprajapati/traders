"use client";

import { useState, useTransition } from "react";
import { Building2, Megaphone, Phone, Save, Share2, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { Spinner } from "@/components/ui/feedback";
import { updateBusinessSettingsAction } from "@/features/admin/actions";
import type { BusinessSettingsRecord } from "@/features/admin/types";

interface SettingsFormProps {
  initialSettings: BusinessSettingsRecord;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  // Business Profile
  const [businessName, setBusinessName] = useState(initialSettings.businessName ?? "Sagar Traders");
  const [tagline, setTagline] = useState(initialSettings.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState(initialSettings.logoUrl ?? "");
  const [address, setAddress] = useState(initialSettings.address ?? "");
  const [gstNumber, setGstNumber] = useState(initialSettings.gstNumber ?? "");

  // Contact
  const [phone, setPhone] = useState(initialSettings.phone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(initialSettings.whatsappNumber ?? "");
  const [email, setEmail] = useState(initialSettings.email ?? "");

  // Operations
  const [businessHours, setBusinessHours] = useState(initialSettings.businessHours ?? "");
  const [deliveryCoverage, setDeliveryCoverage] = useState(initialSettings.deliveryCoverage ?? "");
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialSettings.googleMapsUrl ?? "");

  // Delivery coverage (PIN-code checker on /delivery-check). Nothing is assumed: left empty = "contact us".
  const [deliveryEnabled, setDeliveryEnabled] = useState(
    initialSettings.delivery?.enabled ?? false,
  );
  const [deliveryPincodes, setDeliveryPincodes] = useState(
    (initialSettings.delivery?.pincodes ?? []).join(", "),
  );
  const [deliveryLocalities, setDeliveryLocalities] = useState(
    initialSettings.delivery?.localities ?? "",
  );
  const [deliveryNotes, setDeliveryNotes] = useState(initialSettings.delivery?.notes ?? "");
  const [deliveryTerms, setDeliveryTerms] = useState(initialSettings.delivery?.terms ?? "");

  // Announcement
  const [announcementEnabled, setAnnouncementEnabled] = useState(
    initialSettings.announcement.enabled ?? false,
  );
  const [announcementText, setAnnouncementText] = useState(initialSettings.announcement.text ?? "");

  // Social
  const [facebook, setFacebook] = useState(initialSettings.social.facebook ?? "");
  const [instagram, setInstagram] = useState(initialSettings.social.instagram ?? "");
  const [youtube, setYoutube] = useState(initialSettings.social.youtube ?? "");

  // Why choose us (up to 6 pairs)
  const [whyItems, setWhyItems] = useState<{ title: string; description: string }[]>(() => {
    const existing = initialSettings.whyChooseUs || [];
    const items = [...existing];
    while (items.length < 6) {
      items.push({ title: "", description: "" });
    }
    return items.slice(0, 6);
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleWhyChange = (index: number, field: "title" | "description", value: string) => {
    setWhyItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!businessName.trim()) {
      errs.businessName = "Business name cannot be empty.";
    }

    if (phone.trim() && !/^[+()\d\s-]{7,25}$/.test(phone.trim())) {
      errs.phone = "Phone number must contain between 7 and 25 valid phone characters.";
    }

    if (whatsappNumber.trim()) {
      const digits = whatsappNumber.replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) {
        errs.whatsappNumber = "WhatsApp number must contain 8–15 digits including country code.";
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid e-mail address.";
    }

    if (gstNumber.trim()) {
      const g = gstNumber.trim().toUpperCase();
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) {
        errs.gstNumber = "Must be a valid 15-character GSTIN (e.g. 09ABCDE1234F1Z5).";
      }
    }

    if (googleMapsUrl.trim()) {
      try {
        const u = new URL(googleMapsUrl.trim());
        if (u.protocol !== "https:") errs.googleMapsUrl = "Must be an HTTPS URL.";
      } catch {
        errs.googleMapsUrl = "Must be a valid URL.";
      }
    }

    // Why Choose Us validation: complete pairs required
    for (let i = 0; i < whyItems.length; i++) {
      const { title, description } = whyItems[i];
      if ((title.trim() && !description.trim()) || (!title.trim() && description.trim())) {
        errs[`why_${i}`] = `Statement #${i + 1} needs both a title and a description.`;
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!validate()) {
      setStatusMessage({
        type: "error",
        text: "Please correct the highlighted validation errors before saving.",
      });
      return;
    }

    startTransition(async () => {
      const record: Record<string, string> = {
        business_name: businessName.trim(),
        tagline: tagline.trim(),
        logo_url: logoUrl.trim(),
        phone: phone.trim(),
        whatsapp_number: whatsappNumber.trim(),
        email: email.trim(),
        address: address.trim(),
        business_hours: businessHours.trim(),
        gst_number: gstNumber.trim().toUpperCase(),
        google_maps_url: googleMapsUrl.trim(),
        delivery_coverage: deliveryCoverage.trim(),
        delivery_enabled: deliveryEnabled ? "TRUE" : "FALSE",
        delivery_pincodes: deliveryPincodes.trim(),
        delivery_localities: deliveryLocalities.trim(),
        delivery_notes: deliveryNotes.trim(),
        delivery_terms: deliveryTerms.trim(),
        announcement_enabled: announcementEnabled ? "TRUE" : "FALSE",
        announcement_text: announcementText.trim(),
        social_facebook: facebook.trim(),
        social_instagram: instagram.trim(),
        social_youtube: youtube.trim(),
      };

      // Add Why Choose Us pairs
      for (let i = 0; i < 6; i++) {
        const item = whyItems[i];
        record[`why_choose_us_${i + 1}_title`] = item.title.trim();
        record[`why_choose_us_${i + 1}_description`] = item.description.trim();
      }

      const res = await updateBusinessSettingsAction(record);
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Business settings successfully saved to Google Sheets (${res.data.updatedCount} settings updated).`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.message,
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-gutter-lg pb-section-lg">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-gutter-md">
        <div>
          <h1 className="text-headline-lg-mobile font-bold md:text-headline-lg text-on-surface">
            Business Settings
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Configure contact details, operational hours, delivery area, and brand statements.
          </p>
        </div>
        <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner className="size-4 mr-2" /> Saving...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" aria-hidden /> Save Settings
            </>
          )}
        </Button>
      </div>

      {statusMessage && (
        <Notification
          tone={statusMessage.type === "success" ? "success" : "error"}
          role={statusMessage.type === "error" ? "alert" : "status"}
        >
          {statusMessage.text}
        </Notification>
      )}

      {/* 1. Company Profile */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Building2 className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-title-lg">Company Profile & Legal Details</CardTitle>
        </CardHeader>
        <CardBody className="p-4 space-y-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business Name" required error={fieldErrors.businessName}>
              {(p) => (
                <Input
                  {...p}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Sagar Traders"
                />
              )}
            </Field>

            <Field
              label="Tagline / Motto"
              helper="Displayed under business name on hero and header"
            >
              {(p) => (
                <Input
                  {...p}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Quality Building & Construction Materials Direct to Site"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="GST Identification Number (GSTIN)"
              helper="15-character registered GSTIN"
              error={fieldErrors.gstNumber}
            >
              {(p) => (
                <Input
                  {...p}
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 09ABCDE1234F1Z5"
                />
              )}
            </Field>

            <Field label="Logo URL (Optional)" helper="Approved HTTPS image URL">
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                />
              )}
            </Field>
          </div>

          <Field label="Physical Business / Yard Address">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. / Plot No., Main Road, Industrial Area / City, State - PIN"
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* 2. Contact & Communications */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Phone className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-title-lg">Contact & Enquiry Communication</CardTitle>
        </CardHeader>
        <CardBody className="p-4 space-y-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              label="Primary Phone Number"
              helper="Used for Call Now header actions"
              error={fieldErrors.phone}
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 91234 56789"
                />
              )}
            </Field>

            <Field
              label="WhatsApp Enquiry Number"
              helper="With country code (e.g. 919123456789)"
              error={fieldErrors.whatsappNumber}
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="e.g. 919123456789"
                />
              )}
            </Field>

            <Field
              label="Official Contact Email"
              helper="Enquiry notifications and customer support"
              error={fieldErrors.email}
            >
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@example.org"
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 3. Operations & Delivery */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Truck className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-title-lg">Operations & Delivery Coverage</CardTitle>
        </CardHeader>
        <CardBody className="p-4 space-y-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business Hours" helper="e.g. Mon–Sat: 8:00 AM – 8:00 PM">
              {(p) => (
                <Input
                  {...p}
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Mon – Sat: 8:00 AM – 7:30 PM (Sunday Closed)"
                />
              )}
            </Field>

            <Field
              label="Google Maps Location URL"
              helper="HTTPS link to Google Maps pin"
              error={fieldErrors.googleMapsUrl}
            >
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              )}
            </Field>
          </div>

          <Field
            label="Delivery Coverage Area"
            helper="Districts, industrial corridors, or radius covered for site transport"
          >
            {(p) => (
              <Input
                {...p}
                value={deliveryCoverage}
                onChange={(e) => setDeliveryCoverage(e.target.value)}
                placeholder="e.g. Within 50 km radius; site dispatch across Varanasi and adjacent districts"
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* 3b. Delivery coverage */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Truck className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-title-lg">Delivery coverage (PIN-code checker)</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4 p-4 sm:p-6">
          <p className="text-body-md text-on-surface-variant">
            Customers can check their PIN code on the Delivery check page. Only list PIN codes you
            have confirmed. A listed PIN code never promises delivery — the page always asks
            customers to confirm with you.
          </p>
          <Checkbox
            label={
              <span className="font-medium text-on-surface">
                Show delivery coverage results to customers
              </span>
            }
            checked={deliveryEnabled}
            onChange={(e) => setDeliveryEnabled(e.target.checked)}
          />
          <Field
            label="Covered PIN codes"
            helper="Six-digit PIN codes separated by commas, spaces or new lines (up to 500)."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={deliveryPincodes}
                onChange={(e) => setDeliveryPincodes(e.target.value)}
                placeholder="e.g. 221001, 221002, 221005"
              />
            )}
          </Field>
          <Field
            label="Covered localities (optional)"
            helper="Shown to customers as information only."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={deliveryLocalities}
                onChange={(e) => setDeliveryLocalities(e.target.value)}
                maxLength={1000}
              />
            )}
          </Field>
          <Field
            label="Delivery notes (optional)"
            helper="Anything you want customers to know. Only write what you can stand behind."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                maxLength={500}
              />
            )}
          </Field>
          <Field
            label="Delivery terms (optional)"
            helper="Minimum order or other terms — only if confirmed by the business."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={2}
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                maxLength={1000}
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* 4. Announcement Banner */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Megaphone className="size-5 text-secondary" aria-hidden />
          <CardTitle className="text-title-lg">Site Announcement Banner</CardTitle>
        </CardHeader>
        <CardBody className="p-4 space-y-4 sm:p-6">
          <Checkbox
            label={
              <span className="font-medium text-on-surface">
                Enable announcement banner at the top of every page
              </span>
            }
            checked={announcementEnabled}
            onChange={(e) => setAnnouncementEnabled(e.target.checked)}
          />

          <Field
            label="Banner Message"
            helper="Keep under 300 characters for high readability across mobile and desktop"
          >
            {(p) => (
              <Input
                {...p}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="e.g. Special bulk rates available for TMT and Cement consignments this week."
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* 5. Social Media Links */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Share2 className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-title-lg">Social Media Profiles</CardTitle>
        </CardHeader>
        <CardBody className="p-4 space-y-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Facebook Profile URL" helper="HTTPS URL">
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              )}
            </Field>

            <Field label="Instagram Profile URL" helper="HTTPS URL">
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              )}
            </Field>

            <Field label="YouTube Channel URL" helper="HTTPS URL">
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="https://youtube.com/..."
                />
              )}
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* 6. Why Choose Us Statements */}
      <Card className="border border-border bg-surface">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-border px-4 py-4 sm:px-6">
          <Sparkles className="size-5 text-secondary" aria-hidden />
          <div>
            <CardTitle className="text-title-lg">Why Choose Us Highlights (Up to 6)</CardTitle>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Factual business strengths displayed on the homepage. Only complete title and
              description pairs are shown.
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-4 space-y-6 sm:p-6">
          {whyItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-md border border-border p-4 bg-surface-muted/20 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-label-sm font-semibold text-primary">
                  Statement #{idx + 1}
                </span>
                {fieldErrors[`why_${idx}`] && (
                  <span className="text-body-md text-error font-medium">
                    {fieldErrors[`why_${idx}`]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="sm:col-span-1">
                  <Field label="Title" helper="Max 80 chars">
                    {(p) => (
                      <Input
                        {...p}
                        value={item.title}
                        onChange={(e) => handleWhyChange(idx, "title", e.target.value)}
                        placeholder="e.g. Verified Weight Precision"
                      />
                    )}
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Description" helper="Max 300 chars">
                    {(p) => (
                      <Input
                        {...p}
                        value={item.description}
                        onChange={(e) => handleWhyChange(idx, "description", e.target.value)}
                        placeholder="e.g. Electronic weighbridge verification and computerized bills with every dispatch."
                      />
                    )}
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </CardBody>
        <CardFooter className="flex flex-col-reverse gap-3 border-t border-border bg-surface-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-body-md text-on-surface-variant">
            Changes persist directly to Google Sheets BusinessSettings worksheet.
          </span>
          <Button type="submit" variant="primary" className="w-full sm:w-auto" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner className="size-4 mr-2" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" aria-hidden /> Save Settings
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
