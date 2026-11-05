import { LandingTemplate } from '../components/templates/LandingTemplate.tsx';
import { copy } from '../content/copy.ts';

export default function Home() {
  return <LandingTemplate copy={copy.landing} />;
}
