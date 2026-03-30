import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4EFF6" }}>
      <AdminSidebar />
      <main style={{ flex: 1, minWidth: 0, padding: "32px 36px", overflowX: "hidden" }}>
        {children}
      </main>
    </div>
  );
}
