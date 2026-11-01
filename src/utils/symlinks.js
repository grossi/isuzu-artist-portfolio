const fs = require("fs");
const path = require("path");

// The build copies public/ and bundles src/, following symlinks, and the
// deploy uploads the result public-read. A committed symlink shows on GitHub
// as a one-line text file, so one pointing at ~/.aws/credentials, a .env or
// .git/ (even through another link) would quietly publish it. The site has no
// reason for any, so none are allowed there.
const CHECKED = ["public", "src", "index.html"];

function findSymlinks(root) {
  const found = [];
  const visit = (file) => {
    const stat = fs.lstatSync(file, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isSymbolicLink()) found.push(path.relative(root, file));
    else if (stat.isDirectory()) for (const name of fs.readdirSync(file)) visit(path.join(file, name));
  };
  for (const name of CHECKED) visit(path.join(root, name));
  return found;
}

function assertNoSymlinks(root) {
  const found = findSymlinks(root);
  if (found.length) {
    throw new Error(`Refusing to build: symlinks in public/ or src/ would publish whatever they point to. Replace them with the files: ${found.join(", ")}`);
  }
}

module.exports = { findSymlinks, assertNoSymlinks };
