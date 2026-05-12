import './style.css';

/**
 * Builds the footer text shown on the landing page.
 */
function createFooterMeta(): string {
  const currentYear = new Date().getFullYear();

  return `Designed for focused shipping. ${currentYear}.`;
}

const footerMetaElement = document.querySelector<HTMLElement>('#footer-meta');

if (footerMetaElement) {
  footerMetaElement.textContent = createFooterMeta();
}
