import type { ArmazixDesktopApi } from "./index";

declare global {
  interface Window {
    armazixDesktop: ArmazixDesktopApi;
  }
}
