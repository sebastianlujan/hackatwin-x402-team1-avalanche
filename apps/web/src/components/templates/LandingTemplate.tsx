import type { LandingCopy } from '../../content/copy.ts';
import { BuiltOnAvalanche } from '../molecules/BuiltOnAvalanche.tsx';
import { Faq } from '../organisms/Faq.tsx';
import { Hero } from '../organisms/Hero.tsx';
import { Manifesto } from '../organisms/Manifesto.tsx';
import { SplitCards } from '../organisms/SplitCards.tsx';
import { TaglineBand } from '../organisms/TaglineBand.tsx';
import styles from './LandingTemplate.module.css';

export function LandingTemplate({ copy }: { readonly copy: LandingCopy }) {
  return (
    <main className={styles.page}>
      <Hero copy={copy.hero} />
      <div className={styles.grid}>
        <Manifesto copy={copy.manifesto} />
        <SplitCards copy={copy.cards} />
      </div>
      <TaglineBand copy={copy.tagline} />
      <Faq copy={copy.faq} />
      <footer className={styles.foot}>
        <BuiltOnAvalanche copy={copy.builtOn} />
      </footer>
    </main>
  );
}
