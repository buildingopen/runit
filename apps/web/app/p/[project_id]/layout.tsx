// ABOUTME: Custom layout for Run Page - full-screen overlay hides global sidebar
// ABOUTME: Matches wireframe design with clean 35/65 split layout

export default function RunPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full-screen overlay to hide the global sidebar
  // Uses fixed positioning to cover the entire viewport
  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)]">
      {children}
    </div>
  );
}
