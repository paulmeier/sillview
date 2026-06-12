/**
 * Presentational metadata for ingestion sources — an icon and a one-line blurb
 * per known type, plus the shared status pill. Kept separate from the kasas
 * descriptor (which carries no icon) so both the Sources list and the per-source
 * detail page render them the same way.
 */

import type { ComponentType } from 'react';
import {
  RiBankCard2Line,
  RiBankLine,
  RiBitCoinLine,
  RiEthLine,
  RiFileList2Line,
  RiKey2Line,
  RiLineChartLine,
  RiLinksLine,
} from '@remixicon/react';
import { Pill } from '../ui';
import type { SourceDTO } from '../../../shared/kasas-types';

type IconType = ComponentType<{ className?: string }>;

interface SourceMeta {
  icon: IconType;
  blurb: string;
}

const META: Record<string, SourceMeta> = {
  simplefin: { icon: RiBankLine, blurb: 'Bank aggregator' },
  plaid: { icon: RiBankCard2Line, blurb: 'Bank aggregator' },
  teller: { icon: RiKey2Line, blurb: 'Bank aggregator' },
  bitcoin: { icon: RiBitCoinLine, blurb: 'On-chain wallets' },
  ethereum: { icon: RiEthLine, blurb: 'On-chain wallets' },
  csv: { icon: RiFileList2Line, blurb: 'Manual file import' },
  market: { icon: RiLineChartLine, blurb: 'Market & reference data' },
};

/** Icon + blurb for a source type, with a neutral fallback for unknown types. */
export function sourceMeta(type: string): SourceMeta {
  return META[type] ?? { icon: RiLinksLine, blurb: '' };
}

export function sourceStatusPill(s: SourceDTO) {
  if (!s.active) return <Pill tone="neutral">Inactive</Pill>;
  if (s.connected) return <Pill tone="green">Connected</Pill>;
  if (s.credentialed || s.oauth) return <Pill tone="amber">Needs credentials</Pill>;
  return <Pill tone="blue">Active</Pill>;
}
