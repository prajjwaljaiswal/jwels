// API fetch wrapper
export { api, setToken } from './api';

// Cart store and helpers
export type { CartItem, AddResult } from './cart';
export { useCart, addToCartWithVendorGuard } from './cart';

// Cart API (server-cart types and client)
export type { ServerCartItem, ServerCart } from './cart-api';
export { serverItemToLocal, cartApi } from './cart-api';

// Permissions / RBAC
export { PERMISSIONS, clearMeCache, useMe, usePermissions } from './permissions';
export type { Permission } from './permissions';

// Currency — config constants (server-safe) + client store
// currency.ts re-exports CURRENCIES, formatPrice, toINR from currency.config,
// so we export from currency.config directly to avoid duplicate identifier errors.
export { CURRENCIES, formatPrice, toINR } from './currency.config';
export type { CurrencyCode } from './currency.config';
export { useCurrency } from './currency';

// Wishlist store
export type { WishlistProduct, WishlistItem } from './wishlist';
export { useWishlist } from './wishlist';

// Addresses API
export type { Address, AddressInput } from './addresses';
export { addressApi } from './addresses';

// Recently viewed (localStorage util)
export { getRecentlyViewed, pushRecentlyViewed } from './recently-viewed';

// Support module — typed API client + DTO types
export { supportApi } from './support/api';
export type { TicketFilters } from './support/api';
export type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SenderRole,
  SupportTicketDTO,
  SupportMessageDTO,
  CannedReplyDTO,
  CreateTicketInput,
} from './support/types';
export {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from './support/types';

// Realtime (socket.io) — provider, hook, singleton
export { RealtimeProvider, useRealtime } from './realtime/RealtimeProvider';
export { useTicketStream } from './realtime/useTicketStream';
export type { TicketStreamHandlers } from './realtime/useTicketStream';
export { getSocket, connectSocket, disconnectSocket } from './realtime/socket';
// In-app notifications + web push
export { NotificationsProvider } from './realtime/NotificationsProvider';
export { useSupportNotifications } from './realtime/notifications';
export type { NotifItem } from './realtime/notifications';
export { enablePush, disablePush, getPushState, pushSupported } from './realtime/push';
export type { PushState } from './realtime/push';

// Vendor context / theming
export type {
  SocialPlatform,
  NavLink,
  FooterColumn,
  SocialLink,
  VendorTheme,
  VendorBrand,
} from './vendor-context';
export {
  defaultTheme,
  mergeTheme,
  VendorProvider,
  useVendor,
  FONT_STACKS,
} from './vendor-context';
