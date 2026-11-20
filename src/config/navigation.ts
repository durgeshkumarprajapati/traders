export const websiteNav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/bulk-enquiry", label: "Bulk Enquiry" },
  { href: "/contact", label: "Contact" },
] as const;

/** One sidebar entry for Categories & Brands (tabs live on the page). */
export const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories & Brands" },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/settings", label: "Settings" },
] as const;
