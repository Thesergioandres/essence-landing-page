export type DispatchStatus =
  | "PENDIENTE"
  | "DESPACHADO"
  | "RECIBIDO"
  | "CANCELADO";

export interface DispatchItem {
  product: {
    _id: string;
    name: string;
    image?: { url?: string } | string;
  };
  quantity: number;
}

export interface DispatchRequest {
  _id: string;
  distributor:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
      };
  requestedBy?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
      };
  dispatchedBy?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
      }
    | null;
  receivedBy?:
    | string
    | {
        _id: string;
        name: string;
        email?: string;
      }
    | null;
  items: DispatchItem[];
  status: DispatchStatus;
  shippingGuide?: string;
  guideImage?: string;
  dispatchNotes?: string;
  notes?: string;
  totalUnits: number;
  createdAt: string;
  updatedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export interface DispatchRequestsQuery {
  status?: DispatchStatus;
  distributorId?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface DispatchRequestsResult {
  data: DispatchRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DispatchHotSector {
  zoneId: string;
  zoneName: string;
  zoneType: "distributor" | "branch";
  units: number;
  revenue: number;
  marginProfit: number;
}
