export interface TxLinkProps {
  readonly hash: string;
  readonly url?: string | undefined;
}

// A hash becomes a link only when the caller has a URL for it; fork hashes never do.
export function TxLink({ hash, url }: TxLinkProps) {
  if (url === undefined) return <code className="hk-tx">{hash}</code>;
  return (
    <a className="hk-tx hk-tx--link" href={url} target="_blank" rel="noopener noreferrer">
      {hash}
    </a>
  );
}
