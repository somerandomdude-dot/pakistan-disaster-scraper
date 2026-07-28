export default function HydrologicalSituation({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="hydrological-heading">
      <h2 id="hydrological-heading" className="section-heading">Hydrological situation</h2>
      <ul className="space-y-2 border-l-2 border-slate-300 dark:border-slate-600 pl-4 text-sm leading-6 text-text-secondary">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}
