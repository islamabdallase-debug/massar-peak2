// ============================================================
//  مسار — useTranslation hook
// ============================================================

import { useAppStore } from '@/store/appStore';
import { AR, EN } from '@/i18n/translations';
import type { TKey } from '@/i18n/translations';

export function useTranslation() {
  const lang = useAppStore((s) => s.lang);
  const isRTL = lang !== 'en';

  function t(key: TKey): string {
    if (lang === 'en') return EN[key] ?? AR[key];
    return AR[key];
  }

  function tBoth(key: TKey): string {
    if (lang === 'both') return `${AR[key]} / ${EN[key]}`;
    return t(key);
  }

  return { t, tBoth, lang, isRTL, dir: isRTL ? 'rtl' : ('ltr' as const) };
}

export function useT() {
  return useTranslation().t;
}
