import { MEASURES, parseCatalogId } from '@/features/catalog/taxonomy';
import type { MapAnalysisGroup } from './mapAnalysisState';

export type ComparisonDimension = 'territory' | 'disease' | 'measure' | 'period';

export type ComparisonDesignKind =
  | 'descriptive'
  | 'independent_place'
  | 'paired_period'
  | 'paired_disease'
  | 'time_series'
  | 'confounded'
  | 'unsupported';

export interface ComparisonIssue {
  code: string;
  severity: 'block' | 'warning' | 'info';
  title: string;
  message: string;
  groupIds: string[];
  remediation?: string;
}

export interface ComparisonAssessment {
  designKind: ComparisonDesignKind;
  differingDimensions: ComparisonDimension[];
  issues: ComparisonIssue[];
  canDescribe: boolean;
  canInfer: boolean;
  candidateTestIds: string[];
}

interface GroupSignature {
  territoryKeys: string[];
  diseaseIds: string[];
  measureIds: string[];
  period: string;
}

function issue(
  group: Pick<MapAnalysisGroup, 'id'>,
  code: string,
  title: string,
  message: string,
  remediation?: string,
): ComparisonIssue {
  return {
    code,
    severity: 'block',
    title,
    message,
    groupIds: [group.id],
    remediation,
  };
}

function isPeriodComplete(group: MapAnalysisGroup): boolean {
  const { time } = group;
  if (!time) return false;
  if (time.mode === 'point') return Boolean(time.point?.trim());
  if (time.mode === 'range') {
    const start = time.start?.trim();
    const end = time.end?.trim();
    return Boolean(start && end && end! >= start!);
  }
  return Boolean(time.periodA?.trim() && time.periodB?.trim());
}

function outcomeIds(group: MapAnalysisGroup) {
  return group.variableIds.map(parseCatalogId).filter((value) => value !== null);
}

export function groupCompletionIssues(group: MapAnalysisGroup): ComparisonIssue[] {
  const issues: ComparisonIssue[] = [];
  const outcomes = outcomeIds(group);

  if (group.territoryIds.length === 0) {
    issues.push(
      issue(
        group,
        'missing_territory',
        'Território não definido',
        `${group.name} ainda não possui estado ou município.`,
        'Selecione os territórios no mapa e confirme a inclusão no grupo.',
      ),
    );
  }
  if (outcomes.length === 0) {
    issues.push(
      issue(
        group,
        'missing_outcome',
        'Doença e medida não definidas',
        `${group.name} precisa de um desfecho principal para ser analisado.`,
        'Escolha uma doença e uma medida, como taxa de internação.',
      ),
    );
  } else if (outcomes.length > 1) {
    issues.push(
      issue(
        group,
        'multiple_outcomes',
        'Mais de um desfecho no mesmo grupo',
        `${group.name} possui ${outcomes.length} combinações de doença e medida.`,
        'Mantenha um desfecho principal por grupo; crie outro grupo para o segundo desfecho.',
      ),
    );
  }
  if (!isPeriodComplete(group)) {
    issues.push(
      issue(
        group,
        'missing_period',
        'Período não definido',
        `${group.name} precisa de ano ou intervalo válido.`,
        'Informe um ano ou delimite o início e o fim do período.',
      ),
    );
  }

  return issues;
}

function territoryKey(group: MapAnalysisGroup): string[] {
  return [...new Set(group.territoryIds.map((territory) => `${territory.level}:${territory.ibgeCode}`))]
    .sort();
}

function periodKey(group: MapAnalysisGroup): string {
  const { time } = group;
  if (time.mode === 'point') return `point:${time.point?.trim() ?? ''}`;
  if (time.mode === 'range') {
    return `range:${time.start?.trim() ?? ''}:${time.end?.trim() ?? ''}`;
  }
  return `compare:${time.periodA?.trim() ?? ''}:${time.periodB?.trim() ?? ''}`;
}

function yearMonthOrdinal(value: string, edge: 'start' | 'end'): number | null {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const month = match[2] ? Number(match[2]) : edge === 'start' ? 1 : 12;
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + month - 1;
}

function periodDurationMonths(group: MapAnalysisGroup): number | null {
  const { time } = group;
  if (time.mode === 'point') return time.point?.includes('-') ? 1 : 12;
  if (time.mode !== 'range' || !time.start || !time.end) return null;
  const start = yearMonthOrdinal(time.start, 'start');
  const end = yearMonthOrdinal(time.end, 'end');
  return start === null || end === null || end < start ? null : end - start + 1;
}

function signature(group: MapAnalysisGroup): GroupSignature {
  const outcomes = outcomeIds(group);
  return {
    territoryKeys: territoryKey(group),
    diseaseIds: [...new Set(outcomes.map((value) => value!.diseaseId))].sort(),
    measureIds: [...new Set(outcomes.map((value) => value!.measureId))].sort(),
    period: periodKey(group),
  };
}

function sameValues(values: string[]): boolean {
  return values.every((value) => value === values[0]);
}

function differingDimensions(signatures: GroupSignature[]): ComparisonDimension[] {
  const dimensions: ComparisonDimension[] = [];
  if (!sameValues(signatures.map((value) => value.territoryKeys.join('|')))) {
    dimensions.push('territory');
  }
  if (!sameValues(signatures.map((value) => value.diseaseIds.join('|')))) {
    dimensions.push('disease');
  }
  if (!sameValues(signatures.map((value) => value.measureIds.join('|')))) {
    dimensions.push('measure');
  }
  if (!sameValues(signatures.map((value) => value.period))) {
    dimensions.push('period');
  }
  return dimensions;
}

function territoryRelationship(signatures: GroupSignature[]): 'identical' | 'disjoint' | 'partial' {
  if (sameValues(signatures.map((value) => value.territoryKeys.join('|')))) return 'identical';

  for (let i = 0; i < signatures.length; i += 1) {
    const left = new Set(signatures[i]!.territoryKeys);
    for (let j = i + 1; j < signatures.length; j += 1) {
      if (signatures[j]!.territoryKeys.some((key) => left.has(key))) return 'partial';
    }
  }
  return 'disjoint';
}

function ecologicalIssue(groups: MapAnalysisGroup[]): ComparisonIssue {
  return {
    code: 'ecological_data',
    severity: 'info',
    title: 'Interpretação em nível populacional',
    message:
      'Os resultados descrevem territórios e períodos agregados; não demonstram risco individual nem causalidade.',
    groupIds: groups.map((group) => group.id),
  };
}

function assessment(
  designKind: ComparisonDesignKind,
  dimensions: ComparisonDimension[],
  issues: ComparisonIssue[],
  canDescribe: boolean,
  canInfer: boolean,
  candidateTestIds: string[] = [],
): ComparisonAssessment {
  return {
    designKind,
    differingDimensions: dimensions,
    issues,
    canDescribe,
    canInfer,
    candidateTestIds,
  };
}

function isAdditiveRawMeasure(measureId: string): boolean {
  const measure = MEASURES.find((candidate) => candidate.id === measureId);
  return measure?.variableType === 'contagem' || measureId === 'custo';
}

export function assessGroupComparison(groups: MapAnalysisGroup[]): ComparisonAssessment {
  if (groups.length === 0) {
    return assessment('unsupported', [], [], false, false);
  }

  const completion = groups.flatMap(groupCompletionIssues);
  if (completion.length > 0) {
    return assessment(
      'unsupported',
      [],
      [
        {
          code: 'incomplete_group',
          severity: 'block',
          title: 'Complete todos os grupos',
          message: 'Cada grupo precisa de território, doença, medida e período antes da análise.',
          groupIds: [...new Set(completion.flatMap((value) => value.groupIds))],
          remediation: 'Abra os grupos indicados e complete os campos pendentes.',
        },
        ...completion,
      ],
      false,
      false,
    );
  }

  const baseIssues = [ecologicalIssue(groups)];
  if (groups.length === 1) {
    return assessment('descriptive', [], baseIssues, true, false);
  }

  const signatures = groups.map(signature);
  const dimensions = differingDimensions(signatures);
  const allGroupIds = groups.map((group) => group.id);

  if (dimensions.length === 0) {
    return assessment(
      'unsupported',
      dimensions,
      [
        {
          code: 'duplicate_group',
          severity: 'block',
          title: 'Grupos sem contraste',
          message: 'Os grupos repetem os mesmos territórios, doença, medida e período.',
          groupIds: allGroupIds,
          remediation: 'Altere somente a dimensão que deseja comparar ou remova o grupo duplicado.',
        },
        ...baseIssues,
      ],
      true,
      false,
    );
  }

  if (dimensions.length > 1) {
    return assessment(
      'confounded',
      dimensions,
      [
        {
          code: 'confounded_dimensions',
          severity: 'block',
          title: 'Comparação confundida',
          message: `Os grupos mudam ${dimensions.length} dimensões ao mesmo tempo (${dimensions.join(', ')}), então não é possível atribuir a diferença a uma delas.`,
          groupIds: allGroupIds,
          remediation: 'Mantenha todas as configurações iguais e varie apenas uma dimensão.',
        },
        ...baseIssues,
      ],
      !dimensions.includes('measure'),
      false,
    );
  }

  const dimension = dimensions[0]!;
  if (dimension === 'measure') {
    return assessment(
      'unsupported',
      dimensions,
      [
        {
          code: 'incompatible_measure',
          severity: 'block',
          title: 'Medidas incompatíveis',
          message: 'Valores em escalas diferentes não formam uma comparação estatística direta.',
          groupIds: allGroupIds,
          remediation: 'Use a mesma medida em todos os grupos.',
        },
        ...baseIssues,
      ],
      false,
      false,
    );
  }

  if (dimension === 'territory') {
    if (territoryRelationship(signatures) === 'partial') {
      return assessment(
        'unsupported',
        dimensions,
        [
          {
            code: 'partial_overlap',
            severity: 'block',
            title: 'Sobreposição parcial entre grupos',
            message: 'Um mesmo território aparece em grupos que também contêm territórios diferentes.',
            groupIds: allGroupIds,
            remediation: 'Use grupos idênticos para comparação pareada ou totalmente disjuntos para grupos independentes.',
          },
          ...baseIssues,
        ],
        true,
        false,
      );
    }

    const measureId = signatures[0]!.measureIds[0]!;
    if (isAdditiveRawMeasure(measureId)) {
      return assessment(
        'independent_place',
        dimensions,
        [
          {
            code: 'raw_count_without_denominator',
            severity: 'block',
            title: 'Contagem bruta sem denominador',
            message: 'Territórios com populações diferentes não devem ser comparados apenas pela contagem bruta.',
            groupIds: allGroupIds,
            remediation: 'Troque para uma taxa padronizada, como internações por 100 mil habitantes.',
          },
          ...baseIssues,
        ],
        true,
        false,
      );
    }

    return assessment(
      'independent_place',
      dimensions,
      baseIssues,
      true,
      true,
      groups.length === 2
        ? ['t-student', 'mann-whitney']
        : ['anova-tukey', 'kruskal-dunn'],
    );
  }

  if (dimension === 'period') {
    if (groups.length !== 2) {
      return assessment(
        'unsupported',
        dimensions,
        [
          {
            code: 'too_many_paired_periods',
            severity: 'block',
            title: 'Mais de dois períodos pareados',
            message: 'Esta etapa aceita dois períodos do mesmo território por comparação.',
            groupIds: allGroupIds,
            remediation: 'Compare dois períodos ou analise a série temporal completa.',
          },
          ...baseIssues,
        ],
        true,
        false,
      );
    }
    const measureId = signatures[0]!.measureIds[0]!;
    const windowDurations = groups.map(periodDurationMonths);
    if (
      isAdditiveRawMeasure(measureId)
      && (windowDurations.some((duration) => duration === null)
        || !sameValues(windowDurations.map(String)))
    ) {
      return assessment(
        'paired_period',
        dimensions,
        [
          {
            code: 'unequal_raw_count_windows',
            severity: 'block',
            title: 'Janelas incompatíveis para contagem bruta',
            message: 'Somar contagens em períodos de durações diferentes cria uma diferença artificial de exposição ao tempo.',
            groupIds: allGroupIds,
            remediation: 'Use janelas com a mesma duração ou troque para uma taxa comparável.',
          },
          ...baseIssues,
        ],
        true,
        false,
      );
    }
    return assessment(
      'paired_period',
      dimensions,
      baseIssues,
      true,
      true,
      ['t-student'],
    );
  }

  if (groups.length !== 2) {
    return assessment(
      'unsupported',
      dimensions,
      [
        {
          code: 'too_many_paired_diseases',
          severity: 'block',
          title: 'Mais de duas doenças pareadas',
          message: 'A comparação pareada direta exige dois desfechos por vez.',
          groupIds: allGroupIds,
          remediation: 'Compare duas doenças ou trate as demais em análises separadas.',
        },
        ...baseIssues,
      ],
      true,
      false,
    );
  }

  return assessment(
    'paired_disease',
    dimensions,
    baseIssues,
    true,
    true,
    ['t-student'],
  );
}
