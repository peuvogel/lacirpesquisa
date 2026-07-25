// TABNET SIH URL ported verbatim from the legacy header (legacy/index.html:45).
// D-03 moves this link out of the global header into Estatística only —
// it must not be re-added to src/app/Header.tsx.
const DATASUS_TABNET_URL = 'http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sih/cnv/niba.def';

/**
 * External link to Portal DATASUS (D-03). `rel="noopener noreferrer"` is
 * the tabnabbing mitigation (T-01-TAB) — not optional, and enforced by this
 * plan's automated grep gate on this file.
 */
export function PortalDatasusLink() {
  return (
    <a
      href={DATASUS_TABNET_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="font-sans text-label font-bold text-text-muted transition-colors hover:text-accent"
    >
      Portal DATASUS <span aria-hidden="true">↗</span>
    </a>
  );
}
