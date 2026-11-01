const fs = require("fs");
const path = require("path");

// The build copies public/ and bundles src/, following symlinks, and the
// deploy uploads the result public-read. A committed symlink shows on GitHub
// as a one-line text file, so one pointing out of the project (to
// ~/.aws/credentials, say) would quietly publish that file. Links that stay
// inside the project are fine.
const CHECKED_DIRS = ["public", "src"];

function findOutsideLinks(root) {
  const realRoot = fs.realpathSync(root);
  const outside = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isSymbolicLink()) {
        let target = null;
        try {
          target = fs.realpathSync(file);
        } catch {
          // dangling
        }
        const relative = target && path.relative(realRoot, target);
        if (!target || relative.startsWith("..") || path.isAbsolute(relative)) outside.push(path.relative(root, file));
      }
    }
  };
  for (const dir of CHECKED_DIRS) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  return outside;
}

function assertNoOutsideLinks(root) {
  const outside = findOutsideLinks(root);
  if (outside.length) {
    throw new Error(`Refusing to build: these symlinks point outside the project or nowhere, and would be published: ${outside.join(", ")}`);
  }
}

module.exports = { findOutsideLinks, assertNoOutsideLinks };
