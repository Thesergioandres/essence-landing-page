/**
 * Order Reducer for Admin Bulk Order System
 * Handles complex state management with automatic recalculation
 */

import { v4 as uuidv4 } from "uuid";
import type {
  AdditionalCost,
  OrderAction,
  OrderItem,
  OrderState,
  WarrantyItem,
} from "../types/admin-order.types";

// ==================== INITIAL STATE ====================
export const initialOrderState: OrderState = {
  // Location
  locationType: "warehouse",
  locationId: null,
  locationName: "Bodega Principal",
  isDistributorSale: false,
  distributorProfitPercentage: 20,

  // Items
  items: [],
  warranties: [],

  // Customer
  customerId: null,
  customerName: null,

  // Financial
  paymentMethod: "cash",
  deliveryMethod: "pickup",
  shippingCost: 0,
  discount: 0,
  discountPercent: 0,
  additionalCosts: [],
  paymentProof: null,
  paymentProofMimeType: null,

  // Credit
  creditDueDate: null,
  initialPayment: 0,

  // Notes
  notes: "",

  // Calculated
  subtotal: 0,
  totalCosts: 0,
  grossProfit: 0,
  netProfit: 0,
  totalPayable: 0,
};

// ==================== CALCULATION HELPERS ====================
const calculateItemMetrics = (
  item: Omit<OrderItem, "subtotal" | "grossProfit">,
  isDistributorSale = false,
  distributorProfitPercentage = 20
): OrderItem => {
  const subtotal = item.quantity * item.unitPrice;
  const purchasePrice = item.purchasePrice || 0; // Safeguard against undefined/NaN
  const hasDistributorPrice =
    typeof item.distributorPrice === "number" &&
    !Number.isNaN(item.distributorPrice);
  const grossProfit = isDistributorSale
    ? hasDistributorPrice
      ? subtotal - item.quantity * (item.distributorPrice || 0)
      : subtotal * (distributorProfitPercentage / 100)
    : subtotal - item.quantity * purchasePrice;
  return { ...item, subtotal, grossProfit } as OrderItem;
};

const recalculateTotals = (state: OrderState): OrderState => {
  // Subtotal from items
  const subtotal = state.items.reduce((sum, item) => sum + item.subtotal, 0);

  // Total additional costs (positive charges) and adjustments (negative)
  const additionalCharges = state.additionalCosts.reduce(
    (sum, cost) => sum + (cost.amount > 0 ? cost.amount : 0),
    0
  );
  const additionalAdjustments = state.additionalCosts.reduce(
    (sum, cost) => sum + (cost.amount < 0 ? Math.abs(cost.amount) : 0),
    0
  );

  // Gross profit from items
  const itemsGrossProfit = state.items.reduce(
    (sum, item) => sum + item.grossProfit,
    0
  );

  // Calculate discount (use amount or percentage)
  let discountAmount = state.discount;
  if (state.discountPercent > 0 && state.discount === 0) {
    discountAmount = (subtotal * state.discountPercent) / 100;
  }

  // Total costs = shipping + additional costs (for display only)
  const totalCosts = state.shippingCost + additionalCharges;

  // Net profit calculation:
  // - For distributor sales, manual discounts reduce the distributor commission
  // - For regular sales, discounts reduce company profit
  // - Additional costs reduce profit (vendor pays these)
  // - Shipping does NOT reduce profit (customer pays this)
  const adjustedGrossProfit = state.isDistributorSale
    ? Math.max(0, itemsGrossProfit - discountAmount)
    : itemsGrossProfit;
  const netProfit = state.isDistributorSale
    ? adjustedGrossProfit - additionalCharges - additionalAdjustments
    : itemsGrossProfit -
      additionalCharges -
      additionalAdjustments -
      discountAmount;

  // Total payable = subtotal + shipping + additional costs - discount
  const totalPayable =
    subtotal + state.shippingCost - additionalAdjustments - discountAmount;

  return {
    ...state,
    subtotal,
    totalCosts,
    grossProfit: adjustedGrossProfit,
    netProfit,
    totalPayable: Math.max(0, totalPayable),
  };
};

// ==================== REDUCER ====================
export function orderReducer(
  state: OrderState,
  action: OrderAction
): OrderState {
  let newState: OrderState;

  switch (action.type) {
    case "SET_LOCATION":
      newState = {
        ...state,
        locationType: action.locationType,
        locationId: action.locationId,
        locationName: action.locationName,
        // Clear items when location changes (stock context changes)
        items: [],
        warranties: [],
      };
      break;

    case "ADD_ITEM": {
      const existingIndex = state.items.findIndex(
        i => i.productId === action.item.productId
      );

      if (existingIndex >= 0) {
        // Update existing item quantity
        const updatedItems = state.items.map((item, index) => {
          if (index === existingIndex) {
            const newQty = item.quantity + action.item.quantity;
            return calculateItemMetrics(
              { ...item, quantity: newQty },
              state.isDistributorSale,
              state.distributorProfitPercentage
            );
          }
          return item;
        });
        newState = { ...state, items: updatedItems };
      } else {
        // Add new item
        const newItem = calculateItemMetrics(
          {
            ...action.item,
            id: uuidv4(),
          },
          state.isDistributorSale,
          state.distributorProfitPercentage
        );
        newState = { ...state, items: [...state.items, newItem] };
      }
      break;
    }

    case "UPDATE_ITEM": {
      const updatedItems = state.items.map(item => {
        if (item.id === action.itemId) {
          const updatedItem = { ...item, ...action.updates };
          return calculateItemMetrics(
            updatedItem,
            state.isDistributorSale,
            state.distributorProfitPercentage
          );
        }
        return item;
      });
      newState = { ...state, items: updatedItems };
      break;
    }

    case "REMOVE_ITEM":
      newState = {
        ...state,
        items: state.items.filter(item => item.id !== action.itemId),
      };
      break;

    case "ADD_WARRANTY": {
      const newWarranty: WarrantyItem = {
        ...action.warranty,
        id: uuidv4(),
      };
      newState = { ...state, warranties: [...state.warranties, newWarranty] };
      break;
    }

    case "REMOVE_WARRANTY":
      newState = {
        ...state,
        warranties: state.warranties.filter(w => w.id !== action.warrantyId),
      };
      break;

    case "SET_CUSTOMER":
      newState = {
        ...state,
        customerId: action.customerId,
        customerName: action.customerName,
      };
      break;

    case "SET_PAYMENT_METHOD":
      newState = {
        ...state,
        paymentMethod: action.method,
        // Clear credit fields if not credit
        creditDueDate: action.method === "credit" ? state.creditDueDate : null,
        initialPayment: action.method === "credit" ? state.initialPayment : 0,
        paymentProof: action.method === "transfer" ? state.paymentProof : null,
        paymentProofMimeType:
          action.method === "transfer" ? state.paymentProofMimeType : null,
      };
      break;

    case "SET_PAYMENT_PROOF":
      newState = {
        ...state,
        paymentProof: action.paymentProof,
        paymentProofMimeType: action.paymentProofMimeType,
      };
      break;

    case "SET_DELIVERY_METHOD":
      newState = {
        ...state,
        deliveryMethod: action.method,
        // Clear shipping cost if pickup
        shippingCost: action.method === "pickup" ? 0 : state.shippingCost,
      };
      break;

    case "SET_SHIPPING_COST":
      newState = { ...state, shippingCost: Math.max(0, action.cost) };
      break;

    case "SET_DISCOUNT":
      newState = {
        ...state,
        discount: Math.max(0, action.amount),
        discountPercent: 0,
      };
      break;

    case "SET_DISCOUNT_PERCENT":
      newState = {
        ...state,
        discountPercent: Math.max(0, Math.min(100, action.percent)),
        discount: 0,
      };
      break;

    case "ADD_ADDITIONAL_COST": {
      const newCost: AdditionalCost = {
        ...action.cost,
        id: uuidv4(),
      };
      newState = {
        ...state,
        additionalCosts: [...state.additionalCosts, newCost],
      };
      break;
    }

    case "REMOVE_ADDITIONAL_COST":
      newState = {
        ...state,
        additionalCosts: state.additionalCosts.filter(
          c => c.id !== action.costId
        ),
      };
      break;

    case "SET_CREDIT_DUE_DATE":
      newState = { ...state, creditDueDate: action.date };
      break;

    case "SET_INITIAL_PAYMENT":
      newState = { ...state, initialPayment: Math.max(0, action.amount) };
      break;

    case "SET_NOTES":
      newState = { ...state, notes: action.notes };
      break;

    case "SET_DISTRIBUTOR_PROFIT": {
      const updatedItems = state.items.map(item =>
        calculateItemMetrics(
          item,
          action.isDistributorSale,
          action.profitPercentage
        )
      );
      newState = {
        ...state,
        isDistributorSale: action.isDistributorSale,
        distributorProfitPercentage: action.profitPercentage,
        items: updatedItems,
      };
      break;
    }

    case "CLEAR_ORDER":
      newState = {
        ...initialOrderState,
        locationType: state.locationType,
        locationId: state.locationId,
        locationName: state.locationName,
        isDistributorSale: state.isDistributorSale,
        distributorProfitPercentage: state.distributorProfitPercentage,
      };
      break;

    case "RECALCULATE":
      newState = state;
      break;

    default:
      return state;
  }

  // Always recalculate totals after any action
  return recalculateTotals(newState);
}
