export function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-ui-skeleton="card"
      style={{ width: "100%", minHeight: "10rem", background: "#e5e7eb" }}
    />
  );
}
