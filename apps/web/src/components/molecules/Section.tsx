import type { ReactNode } from 'react';
import styles from './Section.module.css';

export interface SectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}
