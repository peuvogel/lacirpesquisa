import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useState } from 'react';

import { createTableDocument, type TableDocument } from '@/shared/data-input/tableDocument';
import { RoleBindingPanel } from './RoleBindingPanel';
import { roleExample, roleHelp, roleLabel } from './roleHelp';

const poissonOptions = {
  aliases: { contagem: ['casos'], preditor: ['ano'], offset_exposure: ['populacao'] },
  requiredKeys: ['contagem', 'preditor'],
  numericKeys: ['contagem', 'preditor', 'offset_exposure'],
};

function renderPanel() {
  const document = createTableDocument(
    ['casos', 'ano', 'populacao'],
    [['10', '2020', '1000']],
    'colado',
    () => 'doc-roles',
  );
  return render(
    <RoleBindingPanel
      document={document}
      testId="poisson"
      tabularOptions={poissonOptions}
      onDocumentChange={vi.fn()}
    />,
  );
}

describe('roleLabel', () => {
  it('renders known roles capitalised and accented', () => {
    expect(roleLabel('preditor')).toBe('Preditor');
    expect(roleLabel('offset_exposure')).toBe('Exposição (offset)');
    expect(roleLabel('desfecho_binario')).toBe('Desfecho binário');
    expect(roleLabel('variavel_x')).toBe('Variável X');
  });

  it('capitalises an unknown role instead of leaving it bare', () => {
    expect(roleLabel('alguma_coisa')).toBe('Alguma coisa');
  });
});

describe('roleHelp', () => {
  it('prefers the per-test wording when the role changes meaning', () => {
    expect(roleHelp('prais-winsten', 'variavel_y')).not.toBe(roleHelp('correlacao', 'variavel_y'));
  });

  it('falls back to the generic wording for a test without an override', () => {
    expect(roleHelp('correlacao', 'id')).toBe(roleHelp('t-student', 'id'));
  });
});

describe('roleExample', () => {
  it('prefers the per-test example when the role changes meaning', () => {
    expect(roleExample('correlacao', 'variavel_y')).not.toBe(
      roleExample('prais-winsten', 'variavel_y'),
    );
  });

  it('falls back to the generic example for a test without an override', () => {
    expect(roleExample('correlacao', 'id')).toBe(roleExample('t-student', 'id'));
  });

  it('has nothing to show for a role nobody wrote about', () => {
    expect(roleExample('poisson', 'alguma_coisa')).toBeUndefined();
  });
});

describe('RoleBindingPanel', () => {
  it('labels each selector with the friendly role name', () => {
    renderPanel();

    expect(screen.getByLabelText('Vincular Contagem')).toBeInTheDocument();
    expect(screen.getByLabelText('Vincular Preditor')).toBeInTheDocument();
    expect(screen.getByLabelText('Vincular Exposição (offset)')).toBeInTheDocument();
  });

  it('explains every role of the current test behind the info button', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByText(roleHelp('poisson', 'contagem'))).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'O que significa cada papel' }));

    expect(await screen.findByText(roleHelp('poisson', 'contagem'))).toBeInTheDocument();
    expect(screen.getByText(roleHelp('poisson', 'preditor'))).toBeInTheDocument();
    expect(screen.getByText(roleHelp('poisson', 'offset_exposure'))).toBeInTheDocument();
  });

  it('shows a concrete example next to each definition', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'O que significa cada papel' }));

    expect(await screen.findByText(roleExample('poisson', 'contagem')!)).toBeInTheDocument();
    expect(screen.getByText(roleExample('poisson', 'offset_exposure')!)).toBeInTheDocument();
  });

  it('restores every role to auto-detection, and offers that only when there is something to undo', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [document, setDocument] = useState<TableDocument>(() => createTableDocument(
        ['casos', 'ano', 'populacao'],
        [['10', '2020', '1000']],
        'colado',
        () => 'doc-roles',
      ));
      return (
        <RoleBindingPanel
          document={document}
          testId="poisson"
          tabularOptions={poissonOptions}
          onDocumentChange={setDocument}
        />
      );
    }

    render(<Harness />);
    const restore = screen.getByRole('button', {
      name: 'Restaurar papéis para a detecção automática',
    });
    // Nada escolhido à mão ainda: não há padrão a restaurar.
    expect(restore).toBeDisabled();

    const suggested = (screen.getByLabelText('Vincular Contagem') as HTMLSelectElement).value;
    await user.selectOptions(screen.getByLabelText('Vincular Contagem'), 'doc-roles-col-2');
    expect(screen.getByLabelText('Vincular Contagem')).toHaveValue('doc-roles-col-2');
    expect(restore).toBeEnabled();

    await user.click(restore);
    // De volta à sugestão automática — e não à ausência de escolha.
    expect(screen.getByLabelText('Vincular Contagem')).toHaveValue(suggested);
    expect(restore).toBeDisabled();
  });
});
