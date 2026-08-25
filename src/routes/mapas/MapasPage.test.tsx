import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider, useSession } from '@/shared/session/SessionProvider';
import { MapasPage } from './MapasPage';

function renderMapasPage(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ['/mapas'],
  onSession: (session: ReturnType<typeof useSession>) => void = () => {},
) {
  function SessionObserver() {
    onSession(useSession());
    return null;
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SessionProvider>
        <SessionObserver />
        <MapasPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

function createBahiaGroup() {
  fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 1' }));
}

function chooseEmboliaAndRate() {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar doença' }), {
    target: { value: 'Embolia e trombose arteriais' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }));
  fireEvent.click(screen.getByRole('button', { name: 'TX INTERNAÇÃO' }));
}

describe('MapasPage — grupos explícitos', () => {
  it('mantém o primeiro clique em uma cesta provisória', () => {
    renderMapasPage();

    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));

    expect(screen.getByText('1 território selecionado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Grupo 1' })).toBeEnabled();
    expect(screen.queryByRole('tab', { name: /Grupo 1/i })).not.toBeInTheDocument();
    expect(screen.queryByText('O que você quer descobrir?')).not.toBeInTheDocument();
  });

  it('só delimita o grupo depois da confirmação', () => {
    renderMapasPage();
    createBahiaGroup();

    expect(screen.getByRole('tab', { name: /Grupo 1.*incompleto/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: '1. Doença ou condição' })).toBeInTheDocument();
    expect(screen.getByText(/Bahia · sem doença · sem medida/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar Grupo 2' })).toBeDisabled();
  });

  it('permite que o mesmo estado pertença a dois grupos explícitos', () => {
    renderMapasPage();
    createBahiaGroup();

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 2' }));

    const tabs = screen.getAllByRole('tab', { name: /Grupo [12]/i });
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('1');
    expect(tabs[1]).toHaveTextContent('1');
  });

  it('reabre um grupo e salva seus territórios sem criar outro grupo', () => {
    renderMapasPage();
    createBahiaGroup();

    fireEvent.click(screen.getByRole('button', { name: 'Editar territórios de Grupo 1' }));
    expect(screen.getByText('Editando territórios · Grupo 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rio de Janeiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar territórios do Grupo 1' }));

    expect(screen.getAllByRole('tab', { name: /Grupo 1/i })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /Grupo 1/i })).toHaveTextContent('2');
    expect(screen.getByText(/Bahia, Rio de Janeiro · sem doença/i)).toBeInTheDocument();
  });

  it('reabre a configuração ao selecionar um grupo depois de iniciar outro rascunho', () => {
    renderMapasPage();
    createBahiaGroup();

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('tab', { name: /Grupo 1/i }));

    expect(screen.getByLabelText('Configuração de Grupo 1')).toBeInTheDocument();
  });

  it('configura e abre uma análise descritiva sem sair de Mapas', async () => {
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };
    renderMapasPage(['/mapas'], (session) => {
      sessionRef.current = session;
    });
    createBahiaGroup();
    chooseEmboliaAndRate();

    const start = await screen.findByRole('button', { name: 'Abrir análise descritiva' });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);

    expect(await screen.findByRole('group', { name: 'Análise do recorte' })).toBeInTheDocument();
    expect(sessionRef.current?.researchDesign?.groups[0]?.territories).toEqual([
      { id: '29', label: 'Bahia' },
    ]);
    expect(sessionRef.current?.researchDesign?.goal).toBe('describe');
  });

  it('mostra uma comparação válida entre dois lugares com a mesma taxa e período', async () => {
    renderMapasPage();
    createBahiaGroup();
    chooseEmboliaAndRate();

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rio de Janeiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 2' }));
    chooseEmboliaAndRate();

    expect(await screen.findByText('Grupos independentes por lugar')).toBeInTheDocument();
    expect(screen.getByText('Comparação inferencial possível')).toBeInTheDocument();
    expect(screen.getByText(/t de Student/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar e analisar' })).toBeEnabled();
  });

  it('avisa quando lugar e período mudam juntos, mas preserva a descrição', async () => {
    renderMapasPage();
    createBahiaGroup();
    chooseEmboliaAndRate();

    fireEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rio de Janeiro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 2' }));
    chooseEmboliaAndRate();

    await screen.findByText('Grupos independentes por lugar');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ano final' }), {
      target: { value: '2024' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Comparação confundida');
    expect(screen.getByRole('button', { name: 'Abrir análise descritiva' })).toBeEnabled();
  });

  it('alimenta a cesta com uma região e permite desfazer', () => {
    renderMapasPage();
    const norte = screen.getByRole('checkbox', { name: 'Norte' });

    fireEvent.click(norte);
    expect(screen.getByText('7 territórios selecionados')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Grupo/i })).not.toBeInTheDocument();

    fireEvent.click(norte);
    expect(screen.getByText('0 territórios selecionados')).toBeInTheDocument();
  });

  it('mantém os presets de grupos prontos e abre o primeiro para configuração', () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('button', { name: /Presets/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /5 regiões/i }));

    expect(screen.getByRole('tab', { name: /Norte.*incompleto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sudeste.*incompleto/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Doença ou condição' })).toBeInTheDocument();
  });

  it('invalida a análise aberta quando a configuração do grupo muda', async () => {
    const sessionRef: { current: ReturnType<typeof useSession> | null } = { current: null };
    renderMapasPage(['/mapas'], (session) => {
      sessionRef.current = session;
    });
    createBahiaGroup();
    chooseEmboliaAndRate();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir análise descritiva' }));
    await screen.findByRole('group', { name: 'Análise do recorte' });

    fireEvent.click(screen.getByRole('button', { name: 'MORTALIDADE' }));

    expect(screen.queryByRole('group', { name: 'Análise do recorte' })).not.toBeInTheDocument();
    expect(sessionRef.current?.researchDesign).toBeNull();
  });

  it('limpa grupos, rascunho e análise de uma vez', () => {
    renderMapasPage();
    createBahiaGroup();

    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar mapa' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Sim, apagar' }));

    expect(screen.queryByRole('tab', { name: /Grupo 1/i })).not.toBeInTheDocument();
    expect(screen.getByText('0 territórios selecionados')).toBeInTheDocument();
  });

  it('mantém um único h1 e a configuração fora de dialog lateral', () => {
    renderMapasPage();
    createBahiaGroup();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText('Configuração de Grupo 1').closest('aside')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('MapasPage — colagem e handoff', () => {
  it('cola territórios na cesta sem criar grupo silenciosamente', async () => {
    renderMapasPage();
    fireEvent.click(screen.getByRole('button', { name: 'Colar territórios' }));
    const textarea = screen.getByLabelText('Cole territórios — um por linha');
    fireEvent.change(textarea, {
      target: { value: 'Bahia' },
    });
    fireEvent.blur(textarea);

    expect(await screen.findByText('Reconhecidos (1)')).toBeInTheDocument();
    expect(screen.getByText('1 território selecionado')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Grupo 1/i })).not.toBeInTheDocument();
  });

  it('aplica variáveis vindas do catálogo somente apó confirmar o grupo', async () => {
    renderMapasPage([
      {
        pathname: '/mapas',
        state: {
          catalogVariableIds: ['sih.embolia_e_trombose_arteriais.internacoes'],
        },
      },
    ]);

    expect(screen.queryByRole('tab', { name: /Grupo/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bahia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar Grupo 1' }));

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: /Embolia e trombose arteriais/i }),
      ).toBeChecked(),
    );
  });
});
