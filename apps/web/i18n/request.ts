import { getRequestConfig } from "next-intl/server";
import { defaultLocale, loadMessages } from "./config";

// Single locale for now, no locale in the URL. Locale detection comes with the second language.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: await loadMessages(locale) };
});
