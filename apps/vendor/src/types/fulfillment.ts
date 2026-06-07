export type ShipmentStatus =
  | 'LABEL_GENERATED'
  | 'MANIFEST_GENERATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'RTO_INITIATED'
  | 'RTO_DELIVERED'
  | 'CANCELLED';

export type ManifestStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED';
export type PickupStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface Shipment {
  id: string;
  orderItemId: string;
  orderId: string;
  vendorId: string;
  carrierName: string;
  awb: string | null;
  labelUrl: string | null;
  status: ShipmentStatus;
  weightGrams: number | null;
  dimensions: { lengthCm: number; widthCm: number; heightCm: number } | null;
  declaredValue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentWithOrderItem extends Shipment {
  orderItem: {
    id: string;
    quantity: number;
    priceAtPurchase: string;
    product: { name: string; images: string[] };
    order: {
      id: string;
      createdAt: string;
      shippingAddress: any;
      customer: { name: string; phone: string | null };
    };
  };
}

export interface TrackingEvent {
  id: string;
  shipmentId: string;
  eventName: string;
  eventDescription: string | null;
  eventTime: string;
  eventLocation: string | null;
  createdAt: string;
}

export interface Manifest {
  id: string;
  vendorId: string;
  carrierName: string;
  shipmentCount: number;
  manifestDate: string;
  status: ManifestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ManifestWithShipments extends Manifest {
  shipments: Array<{
    manifestId: string;
    shipmentId: string;
    shipment: ShipmentWithOrderItem;
  }>;
}

export interface CarrierPickup {
  id: string;
  vendorId: string;
  carrierName: string;
  pickupDate: string;
  status: PickupStatus;
  pickupAddress: any;
  notes: string | null;
  carrierRef: string | null;
  createdAt: string;
}

export interface TrackingResponse {
  awb: string;
  carrier: string;
  status: ShipmentStatus;
  labelUrl: string | null;
  trackingUrl: string | null;
  dbEvents: TrackingEvent[];
  liveEvents: Array<{
    eventName: string;
    eventDescription?: string;
    eventTime: string;
    eventLocation?: string;
  }>;
}

export interface ShippingReportSummary {
  total: number;
  inTransit: number;
  delivered: number;
  rto: number;
  avgTransitDays: number;
  deliveryRate: number;
}
