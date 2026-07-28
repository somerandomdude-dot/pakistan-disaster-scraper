export default function MissingDataNotice({ sections = [] }: { sections?: string[] }) {
  return (
    <div role="status" className="border border-slate-300 dark:border-slate-600 bg-background px-3 py-2 text-sm text-text-secondary">
      Some bulletin sections could not be structured automatically.
      {sections.length > 0 && (
        <span className="block text-xs text-text-secondary">
          Unavailable sections: {sections.join(", ")}.
        </span>
      )}
    </div>
  );
}
