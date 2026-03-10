import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5" title={t('languageSelector.label')}>
      <span className="text-xs text-gray-500">🌐</span>
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent text-gray-300 text-xs border border-gray-600 rounded px-1.5 py-0.5 hover:border-gray-400 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
        aria-label={t('languageSelector.label')}
      >
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code} className="bg-gray-900">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
