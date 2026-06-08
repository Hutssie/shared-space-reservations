import { apiPost } from './client';

export type PaymentBreakdown = {
  subtotal: number;
  cleaningFee: number;
  equipmentFee: number;
  serviceFee: number;
  serviceFeePercent?: number;
  total: number;
};

export type CreatePaymentIntentResponse = {
  clientSecret: string;
  paymentIntentId: string;
  paymentIntentStatus: string;
  amountCents: number;
  captureMethod: 'automatic' | 'manual';
  isInstantBookable: boolean;
  breakdown: PaymentBreakdown;
};

export function createPaymentIntent(
  spaceId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<CreatePaymentIntentResponse> {
  return apiPost<CreatePaymentIntentResponse>('/api/payments/create-intent', {
    space_id: spaceId,
    date,
    start_time: startTime,
    end_time: endTime,
  });
}
