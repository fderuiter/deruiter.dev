import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { AdminLoginGateway } from "@/components/admin/AdminLoginGateway";

export const metadata: Metadata = {
  title: "Admin Portal Authentication",
  description: "Secure authoring and administrative management gateway.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <PageLayout
      variant="standard"
      className="items-center justify-center min-h-[85vh]"
    >
      <AdminLoginGateway />
    </PageLayout>
  );
}
