import { defineStore } from 'pinia';
import { getCurrentCustomerData } from '../api/customers';

const normalizeCustomerItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.customers)) return payload.customers;
  return [];
};

const normalizePaymentItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.payments)) return payload.payments;
  return [];
};

export const useCustomerStore = defineStore('customer', {
  state: () => ({
    currentEmail: '',
    username: '',
    currentUserData: null,
    customers: [],
    pendingPaymentsData: null,
    pendingPayments: [],
    loading: false,
    error: null,
    loaded: false,
  }),

  getters: {
    currentCustomer: (state) => state.customers[0] || null,
    currentPendingPayment: (state) => state.pendingPayments[0] || null,
  },

  actions: {
    async fetchCurrentUserData() {
      this.loading = true;
      this.error = null;

      try {
        const payload = await getCurrentCustomerData();
        this.currentEmail = payload?.email || '';
        this.username = payload?.username || '';
        this.currentUserData = payload?.customerData || null;
        this.customers = normalizeCustomerItems(this.currentUserData);
        this.pendingPaymentsData = payload?.pendingPayments || null;
        this.pendingPayments = normalizePaymentItems(this.pendingPaymentsData);
        this.loaded = true;
        return payload;
      } catch (err) {
        this.error = err;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    reset() {
      this.currentEmail = '';
      this.username = '';
      this.currentUserData = null;
      this.customers = [];
      this.pendingPaymentsData = null;
      this.pendingPayments = [];
      this.loading = false;
      this.error = null;
      this.loaded = false;
    },
  },
});
