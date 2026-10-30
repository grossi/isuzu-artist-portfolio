import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import Footer from "components/organisms/Footer";
import Header from "components/organisms/Header";
import Home from "pages/Home";
import WorkGallery from "pages/Works";
import WorkHistory from "pages/History";
import { LanguageProvider } from "i18n/LanguageContext";
import theme from "theme";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <LanguageProvider>
        <BrowserRouter>
          <CssBaseline />
          <Header title="isuZu" />
          <Switch>
            <Route exact path="/" component={Home} />
            <Route path="/work" component={WorkGallery} />
            <Route path="/history" component={WorkHistory} />
          </Switch>
          <Footer />
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}
