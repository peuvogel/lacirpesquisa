export interface InterpretationTextProps {
  paragraphs: string[];
}

/**
 * UI-06 didactic slot — "O que isso significa?" renders user-facing prose as
 * inert JSX text children (no markdown/HTML parsing).
 */
export function InterpretationText({ paragraphs }: InterpretationTextProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-bold text-foreground">O que isso significa?</h3>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed text-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
