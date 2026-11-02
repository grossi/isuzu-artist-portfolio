import React from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import Footer from "components/organisms/Footer";
import Header from "components/organisms/Header";
import Home from "pages/Home";
import WorkGallery from "pages/Works";
import WorkHistory from "pages/History";
import { LanguageProvider } from "i18n/LanguageContext";
import theme from "theme";

// The home page's hero carries the isuZu wordmark and the language switch, so
// the header bar only shows on the other pages.
function SiteHeader() {
  const { pathname } = useLocation();
  return pathname === "/" ? null : <Header title="isuZu" />;
}

// The redesigned footer is the home page's; the other pages keep theirs.
function SiteFooter() {
  const { pathname } = useLocation();
  return <Footer home={pathname === "/"} />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <LanguageProvider>
        <BrowserRouter>
          <CssBaseline />
          <SiteHeader />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/work/*" element={<WorkGallery />} />
            <Route path="/history/*" element={<WorkHistory />} />
          </Routes>
          <SiteFooter />
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
