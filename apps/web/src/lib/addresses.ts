import { api } from './api';

export interface Address {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Omit<Address, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & {
  isDefault?: boolean;
};

export const addressApi = {
  list: () => api<{ items: Address[] }>('/api/addresses', { silent: true }),
  create: (input: AddressInput) =>
    api<Address>('/api/addresses', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<AddressInput>) =>
    api<Address>(`/api/addresses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  setDefault: (id: string) =>
    api<{ ok: true }>(`/api/addresses/${id}/default`, { method: 'POST' }),
  remove: (id: string) =>
    api<void>(`/api/addresses/${id}`, { method: 'DELETE' }),
};
