export function RankingSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-ui-skeleton="ranking"
      style={{ display: "grid", gap: "0.75rem" }}
    >
      {["70%", "55%", "40%"].map((width) => (
        <span key={width} style={{ width, height: "1.5rem", background: "#e5e7eb" }} />
      ))}
    </div>
  );
}
