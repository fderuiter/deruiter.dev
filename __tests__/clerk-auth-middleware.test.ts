// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isUserAuthorizedAdmin,
  requireAdmin,
  isCurrentUserAdmin,
  getAdminAuthSession,
} from "@/lib/auth/admin";
import * as envModule from "@/lib/env";

const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();
const mockRedirect = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher:
    (routes: string[]) => (req: { nextUrl: { pathname: string } }) => {
      return routes.some((pattern) => {
        const regex = new RegExp(
          "^" + pattern.replace(/\(\.\*\)/g, ".*") + "$"
        );
        return regex.test(req.nextUrl.pathname);
      });
    },
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

function verifiedEmail(emailAddress: string) {
  return { emailAddress, verification: { status: "verified" } };
}

function unverifiedEmail(emailAddress: string) {
  return { emailAddress, verification: { status: "unverified" } };
}

describe("Clerk Admin Authorization & Allowlist Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isUserAuthorizedAdmin() Pure Evaluation", () => {
    it("returns false when neither user ID nor emails are configured (closed by default)", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: undefined,
        ADMIN_EMAILS: undefined,
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_123", [verifiedEmail("admin@example.com")])
      ).toBe(false);
    });

    it("authorizes user matching ADMIN_USER_IDS allowlist (case-insensitive)", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "user_owner123, user_secondary456",
        ADMIN_EMAILS: "",
      } as ReturnType<typeof envModule.getEnv>);

      expect(isUserAuthorizedAdmin("USER_OWNER123", [])).toBe(true);
      expect(isUserAuthorizedAdmin("user_secondary456", [])).toBe(true);
      expect(isUserAuthorizedAdmin("user_intruder", [])).toBe(false);
    });

    it("authorizes user matching ADMIN_EMAILS allowlist when the email is provider-verified", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "frederick@deruiter.dev, admin@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_any", [
          verifiedEmail("FREDERICK@deruiter.dev"),
        ])
      ).toBe(true);
      expect(
        isUserAuthorizedAdmin("user_any", [
          verifiedEmail("guest@example.com"),
          verifiedEmail("admin@deruiter.dev"),
        ])
      ).toBe(true);
      expect(
        isUserAuthorizedAdmin("user_any", [verifiedEmail("stranger@other.org")])
      ).toBe(false);
    });

    it("rejects an allowlisted email whose verification status is anything other than 'verified'", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_attacker", [
          unverifiedEmail("admin@deruiter.dev"),
        ])
      ).toBe(false);
      expect(
        isUserAuthorizedAdmin("user_attacker", [
          {
            emailAddress: "admin@deruiter.dev",
            verification: { status: "expired" },
          },
        ])
      ).toBe(false);
      expect(
        isUserAuthorizedAdmin("user_attacker", [
          {
            emailAddress: "admin@deruiter.dev",
            verification: { status: "failed" },
          },
        ])
      ).toBe(false);
    });

    it("rejects an allowlisted email with no verification record at all", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_attacker", [
          { emailAddress: "admin@deruiter.dev" },
        ])
      ).toBe(false);
      expect(
        isUserAuthorizedAdmin("user_attacker", [
          { emailAddress: "admin@deruiter.dev", verification: null },
        ])
      ).toBe(false);
    });

    it("rejects a verified email that does not match the allowlist (mismatched identity)", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_stranger", [
          verifiedEmail("stranger@other.org"),
        ])
      ).toBe(false);
    });

    it("authorizes a verified secondary email even when the (unverified) first entry does not match", () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      expect(
        isUserAuthorizedAdmin("user_any", [
          unverifiedEmail("personal@example.com"),
          verifiedEmail("admin@deruiter.dev"),
        ])
      ).toBe(true);
    });
  });

  describe("isCurrentUserAdmin() & requireAdmin() Server Guards", () => {
    it("returns false from isCurrentUserAdmin when session is unauthenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const isAdmin = await isCurrentUserAdmin();
      expect(isAdmin).toBe(false);
    });

    it("returns true from isCurrentUserAdmin when authenticated user is authorized via verified email", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@test.com",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_admin_valid" });
      mockCurrentUser.mockResolvedValue({
        id: "user_admin_valid",
        emailAddresses: [verifiedEmail("admin@test.com")],
      });

      const isAdmin = await isCurrentUserAdmin();
      expect(isAdmin).toBe(true);
    });

    it("returns false from isCurrentUserAdmin when the matching email is unverified", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "admin@test.com",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_attacker" });
      mockCurrentUser.mockResolvedValue({
        id: "user_attacker",
        emailAddresses: [unverifiedEmail("admin@test.com")],
      });

      const isAdmin = await isCurrentUserAdmin();
      expect(isAdmin).toBe(false);
    });

    it("returns false from isCurrentUserAdmin when the Clerk provider call fails", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "user_admin_valid",
        ADMIN_EMAILS: "",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_admin_valid" });
      mockCurrentUser.mockRejectedValue(
        new Error("Clerk backend API unavailable")
      );

      const isAdmin = await isCurrentUserAdmin();
      expect(isAdmin).toBe(false);
    });

    it("redirects to /admin/login in requireAdmin() when user is unauthenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      await requireAdmin();
      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    });

    it("throws 403 error in requireAdmin() when authenticated user lacks admin privileges", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "user_allowed_only",
        ADMIN_EMAILS: "",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_unauthorized" });
      mockCurrentUser.mockResolvedValue({
        id: "user_unauthorized",
        emailAddresses: [verifiedEmail("unauthorized@test.com")],
      });

      await expect(requireAdmin()).rejects.toThrow("403 Forbidden");
    });

    it("returns userId in requireAdmin() when user is authorized", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "user_authorized",
        ADMIN_EMAILS: "",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_authorized" });
      mockCurrentUser.mockResolvedValue({
        id: "user_authorized",
        emailAddresses: [verifiedEmail("authorized@test.com")],
      });

      const result = await requireAdmin();
      expect(result).toEqual({ userId: "user_authorized" });
    });
  });

  describe("getAdminAuthSession() Graceful Authorization Lifecycle", () => {
    it("redirects to /admin/login when session is unauthenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const session = await getAdminAuthSession();
      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
      expect(session.isAuthenticated).toBe(false);
      expect(session.isAdmin).toBe(false);
    });

    it("returns non-admin session object when authenticated user is not in allowlist", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "user_other_admin",
        ADMIN_EMAILS: "admin@portfolio.com",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_visitor_999" });
      mockCurrentUser.mockResolvedValue({
        id: "user_visitor_999",
        fullName: "Visitor Author",
        emailAddresses: [verifiedEmail("visitor@custom.org")],
      });

      const session = await getAdminAuthSession();
      expect(session.isAuthenticated).toBe(true);
      expect(session.isAdmin).toBe(false);
      expect(session.userId).toBe("user_visitor_999");
      expect(session.primaryEmail).toBe("visitor@custom.org");
      expect(session.displayName).toBe("Visitor Author");
    });

    it("returns authorized admin session object when user is in allowlist via a verified email", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "fred@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_admin_fred" });
      mockCurrentUser.mockResolvedValue({
        id: "user_admin_fred",
        firstName: "Fred",
        emailAddresses: [verifiedEmail("fred@deruiter.dev")],
      });

      const session = await getAdminAuthSession();
      expect(session.isAuthenticated).toBe(true);
      expect(session.isAdmin).toBe(true);
      expect(session.userId).toBe("user_admin_fred");
      expect(session.primaryEmail).toBe("fred@deruiter.dev");
      expect(session.displayName).toBe("Fred");
    });

    it("denies admin access when the allowlisted email exists on the account but was never verified", async () => {
      vi.spyOn(envModule, "getEnv").mockReturnValue({
        ADMIN_USER_IDS: "",
        ADMIN_EMAILS: "fred@deruiter.dev",
      } as ReturnType<typeof envModule.getEnv>);

      mockAuth.mockResolvedValue({ userId: "user_impersonator" });
      mockCurrentUser.mockResolvedValue({
        id: "user_impersonator",
        firstName: "Impersonator",
        emailAddresses: [unverifiedEmail("fred@deruiter.dev")],
      });

      const session = await getAdminAuthSession();
      expect(session.isAdmin).toBe(false);
      // The account identity itself is still surfaced (client-visible display data,
      // never the authorization boundary), only elevated privileges are withheld.
      expect(session.primaryEmail).toBe("fred@deruiter.dev");
    });
  });
});
