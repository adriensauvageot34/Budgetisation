export function ModuleComingSoon({ name }: { name: string }) {
  return (
    <section className="card mx-auto max-w-2xl p-8 text-center">
      <p className="eyebrow">Écran temporaire — Étape 0</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{name}</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        Ce placeholder neutralise l’ancienne route. Sa fonctionnalité V2 sera
        conçue ultérieurement à partir des nouveaux contrats.
      </p>
    </section>
  );
}
