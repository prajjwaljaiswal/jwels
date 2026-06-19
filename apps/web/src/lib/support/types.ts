// Support module DTO types (local copy for the self-contained customer app).
export type TicketStatus = 'OPEN' | 'PENDING' | 'AWAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'ORDER' | 'PAYMENT' | 'RETURN_REFUND' | 'PRODUCT' | 'SHIPPING'
  | 'ACCOUNT' | 'VENDOR_ONBOARDING' | 'TECHNICAL' | 'OTHER';
export type SenderRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN' | 'SYSTEM';

export const TICKET_CATEGORIES: TicketCategory[] = [
  'ORDER', 'PAYMENT', 'RETURN_REFUND', 'PRODUCT', 'SHIPPING', 'ACCOUNT', 'TECHNICAL', 'OTHER',
];
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER: 'Order', PAYMENT: 'Payment', RETURN_REFUND: 'Return / Refund', PRODUCT: 'Product',
  SHIPPING: 'Shipping', ACCOUNT: 'Account', VENDOR_ONBOARDING: 'Onboarding', TECHNICAL: 'Technical', OTHER: 'Other',
};
export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open', PENDING: 'Pending', AWAITING_CUSTOMER: 'Awaiting your reply', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

export interface SupportMessageDTO {
  id: string;
  ticketId: string;
  authorId: string;
  authorRole: SenderRole;
  authorName: string;
  body: string;
  attachments: string[];
  isInternalNote: boolean;
  flagged: boolean;
  flagReason: string | null;
  systemEvent: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface SupportTicketDTO {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creatorId: string;
  creatorRole: SenderRole;
  creatorName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  orderId: string | null;
  orderItemId: string | null;
  productId: string | null;
  productName: string | null;
  productImage: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  unread: number;
  lastMessageAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  canSeeInternalNotes?: boolean;
}

export interface CreateTicketInput {
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  vendorId?: string;
  orderId?: string;
  orderItemId?: string;
  productId?: string;
  body: string;
  attachments?: string[];
}
