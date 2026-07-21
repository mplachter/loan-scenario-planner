interface SectionTitleProps {
  title: string;
  note?: string;
}

export function SectionTitle({ title, note }: SectionTitleProps) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {note && <p className="text-sm text-slate-500 mt-1">{note}</p>}
    </div>
  );
}
