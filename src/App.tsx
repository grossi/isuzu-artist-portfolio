import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import Footer from "components/organisms/Footer";
import Header from "components/organisms/Header";
import Home from "pages/Home";
import WorkGallery from "pages/Works";
import WorkHistory from "pages/History";

const sections = [
  { title: "仕事", url: "/work" },
  { title: "職務経歴書", url: "/history" },
];

export default function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Header title="isuZu" sections={sections} />
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/work" component={WorkGallery} />
        <Route path="/history" component={WorkHistory} />
      </Switch>
      <Footer
        title="isuZu"
        description="Footer Text"
      />
    </BrowserRouter>
  );
}
