const SectionLabel = ({ children, hint }) => {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
    </div>
  );
};

export default SectionLabel;
