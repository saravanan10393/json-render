/**
 * E-commerce fragment bundle.
 *
 * Standard entity contracts these fragments expect (field ids are FIXED —
 * define entities with exactly these ids):
 *
 *   Product:  Name(text) Description(text) Price(number) Category(select)
 *             ImageUrl(text) Rating(number) Stock(number)
 *   CartItem: ProductId(text) Name(text) Price(number) Quantity(number)
 *             LineTotal(number)
 *   Order:    CustomerName(text) Email(text) Address(text) City(text)
 *             Zip(text) Status(select: Placed|Shipped|Delivered|Cancelled)
 *             Total(number) PlacedAt(date)
 */
import type { FragmentRegistry } from "@/lib/jr/schema";
import { ProductQuickView } from "./ProductQuickView";
import { TestimonialStrip } from "./TestimonialStrip";
import { FeatureHighlights } from "./FeatureHighlights";
import { CartSummary } from "./CartSummary";
import { CategoryNav } from "./CategoryNav";
import { CheckoutForm } from "./CheckoutForm";
import { FilterSidebar } from "./FilterSidebar";
import { HeroBanner } from "./HeroBanner";
import { OrderHistoryList } from "./OrderHistoryList";
import { ProductFilterBar } from "./ProductFilterBar";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { SalesStats } from "./SalesStats";

export const ecommerceFragments = {
  HeroBanner,
  CategoryNav,
  ProductFilters,
  FilterSidebar,
  ProductFilterBar,
  ProductGrid,
  CartSummary,
  CheckoutForm,
  OrderHistoryList,
  SalesStats,
  FeatureHighlights,
  TestimonialStrip,
  ProductQuickView,
} as unknown as FragmentRegistry;
