import { OrderItem } from '../../../utils/storage';
import { PurchaseDetails } from '../../../lib/zk/commitment';

export type ProcessingState = 'loading' | 'extracted' | 'error' | 'no-data';
export type ZkStep = 'idle' | 'generating' | 'approving' | 'purchasing' | 'success';

export interface ZkCommitmentDisplayData {
    commitment: string;
    tier: number;
    premium: string;
    invoicePrice: string;
    details: PurchaseDetails;
    itemData: OrderItem;
}

export interface ZkPurchaseState {
    processing: boolean;
    step: ZkStep;
    error: string | null;
    commitmentData: ZkCommitmentDisplayData | null;
    selectedItem: OrderItem | null;
}
