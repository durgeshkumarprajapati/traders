// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminConsoleLayout from "./(console)/layout";
import AdminAuthLayout from "./(auth)/layout";
import LoginPage from "./(auth)/login/page";
import * as adminAuth from "@/lib/auth/admin";

const mockRedirect = vi.fn();
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/dashboard",
}));

describe("Admin Layout & Authentication Boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AdminAuthLayout ((auth) route group)", () => {
    it("renders the clean auth shell with brand heading and back link without sidebar", async () => {
      vi.spyOn(adminAuth, "getAuthenticatedAdmin").mockResolvedValue(null);

      const ui = await AdminAuthLayout({
        children: <div data-testid="auth-child">Auth Form</div>,
      });
      render(ui);

      expect(screen.getByText("Sagar Traders Admin")).toBeInTheDocument();
      expect(screen.getByText("Back to Sagar Traders")).toBeInTheDocument();
      expect(screen.getByTestId("auth-child")).toBeInTheDocument();
      // Ensure sidebar is NOT present
      expect(screen.queryByRole("navigation", { name: "Admin" })).not.toBeInTheDocument();
    });

    it("redirects authenticated active admin away to /admin/dashboard", async () => {
      vi.spyOn(adminAuth, "getAuthenticatedAdmin").mockResolvedValue({
        id: "admin-1",
        email: "admin@sagartraders.in",
        fullName: "Sagar Admin",
        isActive: true,
      });

      await expect(AdminAuthLayout({ children: <div>Login Form</div> })).rejects.toThrowError(
        "NEXT_REDIRECT:/admin/dashboard",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  describe("AdminConsoleLayout ((console) route group)", () => {
    it("redirects unauthenticated visitor to /admin/login", async () => {
      vi.spyOn(adminAuth, "requireAdminSession").mockImplementation(async () => {
        mockRedirect("/admin/login");
        throw new Error("NEXT_REDIRECT:/admin/login");
      });

      await expect(AdminConsoleLayout({ children: <div>Dashboard</div> })).rejects.toThrowError(
        "NEXT_REDIRECT:/admin/login",
      );
      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    });

    it("renders console sidebar with navigation and sign-out button when authorized", async () => {
      vi.spyOn(adminAuth, "requireAdminSession").mockResolvedValue({
        id: "admin-1",
        email: "admin@sagartraders.in",
        fullName: "Sagar Admin",
        isActive: true,
      });

      const ui = await AdminConsoleLayout({
        children: <div data-testid="dashboard-content">Dashboard Content</div>,
      });
      render(ui);

      expect(screen.getByRole("navigation", { name: "Admin" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Products" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Categories & Brands" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Enquiries" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
      expect(screen.getByText("Sagar Admin")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-content")).toBeInTheDocument();
    });
  });

  describe("LoginPage (/admin/login UI)", () => {
    it("renders the real login form with email, password, and sign-in button", async () => {
      render(<LoginPage />);

      expect(screen.getByRole("heading", { name: "Administrator Sign In" })).toBeInTheDocument();

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autocomplete", "email");

      const passwordInput = screen.getByLabelText(/^password/i, { selector: "input" });
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(passwordInput).toHaveAttribute("autocomplete", "current-password");

      expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    });
  });
});
