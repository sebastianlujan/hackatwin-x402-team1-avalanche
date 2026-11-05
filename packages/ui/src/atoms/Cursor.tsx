export interface CursorProps {
  readonly text: string;
}

// The caret is decoration; the text alone carries the meaning.
export function Cursor({ text }: CursorProps) {
  return (
    <span className="hk-cursor">
      {text}
      <span className="hk-cursor__caret" aria-hidden="true">
        _
      </span>
    </span>
  );
}
