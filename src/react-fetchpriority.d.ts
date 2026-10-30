// The fetchpriority attribute predates @types/react support for it.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match the original declaration to merge
  interface ImgHTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}

export {};
