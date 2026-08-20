import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResearchDesign } from '@/features/research/types';
import { SessionProvider } from '@/shared/session/SessionProvider';
import { GuidedAnalysisWorkspace } from './GuidedAnalysisWorkspace';

const guidedDesign: ResearchDesign = {
  groups: [
    {
      id: 'nordeste',
      name: 'Nordeste',
      territories: [
        { id: '29', label: 'Bahia' },
        { id: '28', label: 'Sergipe' },
      ],
    },
  ],
  geography: 'uf',
  locationBasis: 'ocorrencia',
  diseaseIds: ['embolia_e_trombose_arteriais'],
  period: { scope: 'shared', time: { mode: 'range', start: '2023', end: '2025' } },
};

describe('GuidedAnalysisWorkspace', () => {
  it('renders the guided analysis without a second page header when embedded', () => {
    render(
      <SessionProvider>
        <GuidedAnalysisWorkspace design={guidedDesign} embedded />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { level: 2, name: /Nordeste · Embolia/i })).toBeInTheDocument();
    expect(screen.queryByTestId('guided-page-shell')).not.toBeInTheDocument();
  });

  it('keeps the guided summary as the route h1 outside Mapas', () => {
    render(
      <SessionProvider>
        <GuidedAnalysisWorkspace design={guidedDesign} />
      </SessionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /Nordeste · Embolia/i })).toBeInTheDocument();
  });
});
