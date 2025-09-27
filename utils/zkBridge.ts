// ZK Bridge - Converts Amazon extension data to ZK commitment inputs
import { OrderItem } from './storage';

export interface ZKCommitmentInput {
    orderNumber: string;
    invoiceNumber: string;
    priceUsd: number;
    purchaseDateIso: string;
    transactionId: string;
    productId: string; // ASIN
}

export function convertAmazonDataToZKInput(orderItem: OrderItem): ZKCommitmentInput {
    // Convert Amazon extension data to ZK commitment format
    const priceUsd = parseFloat(orderItem.price?.replace(/[₹$,]/g, '') || '0');

    return {
        orderNumber: orderItem.orderId || `ORDER_${Date.now()}`,
        invoiceNumber: orderItem.orderId || `INV_${Date.now()}`,
        priceUsd: priceUsd,
        purchaseDateIso: orderItem.orderDate ?
            new Date(orderItem.orderDate).toISOString() :
            new Date().toISOString(),
        transactionId: orderItem.orderId || `TXN_${Date.now()}`,
        productId: orderItem.asin || `PRODUCT_${Date.now()}`
    };
}

export function validateZKInput(input: ZKCommitmentInput): boolean {
    return !!(
        input.orderNumber &&
        input.priceUsd > 0 &&
        input.productId &&
        input.purchaseDateIso
    );
}