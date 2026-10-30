/** Eingabefeld mit Fehler direkt am Feld. */
export function Field({ id, label, value, onChange, error, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input num"
        inputMode="decimal"
        value={value}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {(error || hint) && (
        <span id={`${id}-msg`} className={error ? 'field-error' : 'tiny muted'} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}
