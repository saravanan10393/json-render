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
import { CartSummary } from "./CartSummary";
import { CategoryNav } from "./CategoryNav";
import { CheckoutForm } from "./CheckoutForm";
import { HeroBanner } from "./HeroBanner";
import { OrderHistoryList } from "./OrderHistoryList";
import { ProductFilters } from "./ProductFilters";
import { ProductGrid } from "./ProductGrid";
import { SalesStats } from "./SalesStats";

export const ecommerceFragments = {
  HeroBanner,
  CategoryNav,
  ProductFilters,
  ProductGrid,
  CartSummary,
  CheckoutForm,
  OrderHistoryList,
  SalesStats,
} as unknown as FragmentRegistry;
