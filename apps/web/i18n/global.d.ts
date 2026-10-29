import type messages from "./strings_en.json";
import type { AppLocale } from "./config";

// Type-checks every translation key against strings_en.json.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
