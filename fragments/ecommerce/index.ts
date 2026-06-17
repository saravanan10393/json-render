/**
 * E-commerce fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Product:  Name(text) Description(text) Price(number) Category(select)
 *             ImageUrl(text) Rating(number) Stock(number)
 *             — OPTIONAL (PDP affordances; blocks degrade when absent):
 *               Brand(text) CompareAtPrice(number) ReviewCount(number)
 *               Colors(text[] of CSS colors) Sizes(text[]) Images([{image}] gallery objects)
 *   CartItem: ProductId(text) Name(text) Price(number) Quantity(number)
 *             LineTotal(number) — OPTIONAL: ImageUrl(text) for a line thumbnail
 *   Order:    CustomerName(text) Email(text) Address(text) City(text)
 *             Zip(text) Status(select: Placed|Shipped|Delivered|Cancelled)
 *             Total(number) PlacedAt(date)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { FeaturedProduct } from "./FeaturedProduct";
import { TestimonialStrip } from "./TestimonialStrip";
import { FeatureHighlights } from "./FeatureHighlights";
import { CartSummary } from "./CartSummary";
import { CategoryNav } from "./CategoryNav";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutStepper } from "./CheckoutStepper";
import { EmptyCart } from "./EmptyCart";
import { OrderConfirmation } from "./OrderConfirmation";
import { OrderDetail } from "./OrderDetail";
import { OrderTracking } from "./OrderTracking";
import { AccountDashboard } from "./AccountDashboard";
import { ShippingMethodSelector } from "./ShippingMethodSelector";
import { FreeShippingProgress } from "./FreeShippingProgress";
import { MiniCartDrawer } from "./MiniCartDrawer";
import { PromoCodeField } from "./PromoCodeField";
import { FilterSidebar } from "./FilterSidebar";
import { HeroBanner } from "./HeroBanner";
import { OrderHistoryList } from "./OrderHistoryList";
import { OrderSummary } from "./OrderSummary";
import { ProductFilterBar } from "./ProductFilterBar";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { ProductOverview } from "./ProductOverview";
import { SalesStats } from "./SalesStats";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewList } from "./ReviewList";
import { WriteReviewForm } from "./WriteReviewForm";
import { FaqAccordion } from "./FaqAccordion";
import { AnnouncementBar } from "./AnnouncementBar";
import { OfferModal } from "./OfferModal";

export const ecommerceFragments = {
  HeroBanner,
  CategoryNav,
  ProductFilters,
  FilterSidebar,
  ProductFilterBar,
  ProductGrid,
  ProductOverview,
  CartSummary,
  OrderSummary,
  MiniCartDrawer,
  PromoCodeField,
  FreeShippingProgress,
  EmptyCart,
  CheckoutForm,
  CheckoutStepper,
  ShippingMethodSelector,
  OrderConfirmation,
  OrderHistoryList,
  OrderDetail,
  OrderTracking,
  AccountDashboard,
  SalesStats,
  FeatureHighlights,
  TestimonialStrip,
  FeaturedProduct,
  ReviewSummary,
  ReviewList,
  WriteReviewForm,
  FaqAccordion,
  AnnouncementBar,
  OfferModal,
} as unknown as FragmentRegistry;
