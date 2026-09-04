import { Link } from 'react-router-dom';

// T-01-ROUTE mitigation: a render error in one route must not blank the
// whole portal. Friendly Portuguese fallback with a way back to Estatística.
export function RouteError() {
  return (
    <main className="mx-auto flex max-w-[1520px] flex-col items-center px-6 py-16 text-center">
      <h1 className="font-sans text-heading font-bold text-text">Algo deu errado</h1>
      <p className="mt-2 max-w-md font-sans text-body font-normal text-text-muted">
        Não foi possível carregar esta página. Volte para a Estatística e tente novamente.
      </p>
      <Link to="/" className="mt-6 font-sans text-label font-bold text-accent hover:underline">
        Voltar para Estatística
      </Link>
    </main>
  );
}
