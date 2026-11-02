import { createTheme } from "@mui/material/styles";

// The isuZu wordmark and the italic section headings (Works, Profile, Books).
export const displayFont = "'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif";
export const bodyFont =
  "'Zen Kaku Gothic New', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

// Material-UI v4 defaults the site was designed with, which MUI v5+ changed.
const theme = createTheme({
  typography: { fontFamily: bodyFont },
  breakpoints: {
    values: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 },
  },
  palette: {
    primary: { main: "#3f51b5" },
    background: { default: "#fafafa" },
    text: { secondary: "rgba(0, 0, 0, 0.54)" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontSize: "0.875rem", lineHeight: 1.43, letterSpacing: "0.01071em" },
      },
    },
    // v4 IconButtons were 48px (12px padding); v5+ shrank them to 40px
    MuiIconButton: { styleOverrides: { sizeMedium: { padding: 12 } } },
    MuiLink: { defaultProps: { underline: "hover" } },
  },
});

export default theme;
