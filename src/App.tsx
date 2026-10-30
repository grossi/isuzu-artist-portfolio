import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import Footer from "components/organisms/Footer";
import Header from "components/organisms/Header";
import Home from "pages/Home";
import WorkGallery from "pages/Works";
import WorkHistory from "pages/History";
import { LanguageProvider } from "i18n/LanguageContext";

export default function App() {
  return (
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
  );
}
