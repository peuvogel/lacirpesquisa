// Two-panel skeleton (map ~60%, panel ~40%). Plan 01-09 fills in the
// interactive Brazil map and variable panel; these are stable mount points.
export function MapasPage() {
  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8">
      <h1 className="font-sans text-display font-bold text-text">Mapas</h1>
      <div className="mt-6 flex gap-8">
        <section className="lacir-mapas-map w-[60%]" aria-label="Mapa do Brasil" />
        <aside className="lacir-mapas-panel w-[40%]" aria-label="Variáveis disponíveis" />
      </div>
    </div>
  );
}
