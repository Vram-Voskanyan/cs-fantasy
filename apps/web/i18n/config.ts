// Add a language: create i18n/strings_<code>.json and add the code here.
export const locales = ["en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";

export async function loadMessages(locale: AppLocale) {
  return (await import(`./strings_${locale}.json`)).default;
}
