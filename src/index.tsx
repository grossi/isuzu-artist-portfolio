import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from 'App';
import 'assets/css/main.css';
// The home page's fonts, served from the site itself. Zen Kaku Gothic New (the
// body text) in the weights the page uses, split by unicode-range so a page
// only downloads the slices for its characters; then Bodoni Moda.
import '@fontsource/zen-kaku-gothic-new/400.css';
import '@fontsource/zen-kaku-gothic-new/500.css';
import '@fontsource/zen-kaku-gothic-new/700.css';
import 'assets/css/fonts.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
