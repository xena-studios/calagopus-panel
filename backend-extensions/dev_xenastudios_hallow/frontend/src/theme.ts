import type { MantineColorsTuple, MantineThemeOverride } from '@mantine/core';

// Hallow violet, lightest to darkest. Shade 6 (#6a4cf5) is the light-scheme primary and keeps
// white text above 5:1; shade 4 is the dark-scheme primary, bright enough on the near-black body.
export const hallowViolet: MantineColorsTuple = [
  '#f2efff',
  '#e1dbff',
  '#c1b4ff',
  '#a08aff',
  '#8467ff',
  '#7352fb',
  '#6a4cf5',
  '#5839da',
  '#4d31c3',
  '#4027ab',
];

// Dark surfaces with a faint cool tint instead of the stock neutral grey: 0 to 2 are text,
// 4 borders, 5 hover, 6 cards and inputs, 7 the page, 8 and 9 the deepest wells.
export const hallowDark: MantineColorsTuple = [
  '#dcdce6',
  '#b9b9c8',
  '#9494a8',
  '#6b6b80',
  '#3c3c4e',
  '#2d2d3c',
  '#20202c',
  '#17171f',
  '#111118',
  '#0b0b10',
];

const fontFamily =
  "Inter, 'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const hallowTheme: MantineThemeOverride = {
  // The core hard-codes `blue` for its accents (create buttons, active links, info alerts); mapping
  // it to the Hallow violet keeps one accent across stock and Hallow pages.
  colors: { hallow: hallowViolet, blue: hallowViolet, dark: hallowDark },
  primaryColor: 'hallow',
  primaryShade: { light: 6, dark: 4 },
  fontFamily,
  fontFamilyMonospace: "ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  headings: {
    fontFamily,
    fontWeight: '650',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
};
