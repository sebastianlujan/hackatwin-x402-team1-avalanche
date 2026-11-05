import type { Hex } from '@hackatwin/core';
import { encodePacked } from 'viem';

// GenericExtraArgsV3 tag from ExtraArgsCodec.
const V3_TAG = '0xa69dd4aa';
const NO_FINALITY = '0x00000000';
const NO_PADDING = '0x00000000000000';

// Basic V3 extra args: tag, gas limit, default finality, no CCVs or executor.
export const extraArgsV3 = (gasLimit: number): Hex =>
  encodePacked(['bytes4', 'uint32', 'bytes4', 'bytes7'], [V3_TAG, gasLimit, NO_FINALITY, NO_PADDING]);
