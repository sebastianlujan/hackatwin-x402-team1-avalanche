import { Cursor } from '@hackatwin/ui';
import Link from 'next/link';
import type { LandingCopy } from '../../content/copy.ts';
import styles from './Hero.module.css';

export function Hero({ copy }: { readonly copy: LandingCopy['hero'] }) {
  return (
    <header className={styles.hero}>
      <Cursor text={copy.brand} />
      <h1>{copy.title}</h1>
      <p className={styles.lead}>{copy.lead}</p>
      <Link className={styles.cta} href={copy.cta.href}>
        {copy.cta.label}
      </Link>
    </header>
  );
}
