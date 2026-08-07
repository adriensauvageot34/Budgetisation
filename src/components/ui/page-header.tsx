export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[clamp(1.8rem,3vw,2.7rem)] font-black leading-[1.05] tracking-[-0.045em]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[0.98rem] leading-6 text-[var(--color-muted)]">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
