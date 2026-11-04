import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'hackatwin x402 team 1',
  tagline: 'Avalanche, x402 and CCIP hackathon docs',
  url: 'https://sebastianlujan.github.io',
  baseUrl: '/hackatwin-x402-team1-avalanche/',
  onBrokenLinks: 'throw',
  future: { v4: true },
  i18n: { defaultLocale: 'en', locales: ['en'] },
  markdown: {
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: { path: '../../docs', routeBasePath: '/', sidebarPath: './sidebars.ts' },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    mermaid: { theme: { light: 'neutral', dark: 'dark' } },
    navbar: { title: 'hackatwin x402 team 1' },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['solidity', 'toml'],
    },
  },
};

export default config;
