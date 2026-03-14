// ABOUTME: Settings layout - standalone centered layout, no sidebar
// ABOUTME: Independent from the run page layout

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg-primary)] overflow-y-auto">
      {children}
    </div>
  );
}
