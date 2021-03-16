import React from "react";
import { BrowserRouter, Route, Switch } from "react-router-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import Footer from "components/Footer";
import Header from "components/Header";
import Home from "pages/Home";
import WorkGallery from "pages/Works";

const sections = [
  { title: "仕事", url: "/work" },
];

export default function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <Header title="isuZu" sections={sections} />
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/work" component={WorkGallery} />
      </Switch>
      <Footer
        title="isuZu"
        description="Footer Text"
      />
    </BrowserRouter>
  );
}
