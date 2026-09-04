import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DidacticCard {
  title: string;
  body: string;
}

export interface DidacticCardsProps {
  cards: DidacticCard[];
  className?: string;
}

export function DidacticCards({ cards, className }: DidacticCardsProps) {
  return null;
}
