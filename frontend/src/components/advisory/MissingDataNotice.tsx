export default function MissingDataNotice({ sections = [] }: { sections?: string[] }) {
  return (
    <div role="status" className="border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      Some bulletin sections could not be structured automatically.
      {sections.length > 0 && (
        <span className="block text-xs text-slate-500">
          Unavailable sections: {sections.join(", ")}.
        </span>
      )}
    </div>
  );
}
