import "react";

// The fetchpriority attribute predates @types/react support for it.
declare module "react" {
  interface ImgHTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
