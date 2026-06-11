import { z } from "zod";
import type { Fragment } from "@/lib/jr/schema";

const Params = z.object({
  title: z.string().default("What Our Customers Say").describe("Section heading"),
  testimonials: z.array(
    z.object({
      quote: z.string(),
      name: z.string(),
      role: z.string()
    })
  ).default([
    {
      quote: "This product transformed our workflow. The team was incredibly responsive and the results exceeded our expectations.",
      name: "Sarah Johnson",
      role: "VP of Operations, Acme Corp"
    },
    {
      quote: "Outstanding quality and service. We've seen a 40% increase in efficiency since adopting this solution.",
      name: "Michael Chen",
      role: "CTO, TechStart Inc"
    },
    {
      quote: "The best investment we've made this year. Highly recommended for any growing business.",
      name: "Emma Davis",
      role: "Founder, Growth Labs"
    }
  ]).describe("Array of testimonial objects with quote, name, and role"),
  columns: z.number().min(1).max(3).default(3).describe("Number of columns (1-3)")
});

type P = z.infer<typeof Params>;

export const TestimonialStrip: Fragment<P> = {
  name: "TestimonialStrip",
  version: "1.0.0",
  description: "Displays customer testimonials in a grid layout. Shows quote cards with customer name and role. Generic component that works with any parameterized testimonials.",
  whenToUse: "Use when you want to display customer testimonials, reviews, quotes, or social proof. Perfect for landing pages, about pages, or anywhere you need to showcase customer feedback.",
  category: "display",
  params: Params as z.ZodType<P>,
  
  build: (params, ns) => {
    const elements: Record<string, any> = {};
    
    // Root container
    elements[ns] = {
      type: "Stack",
      props: {
        direction: "vertical",
        gap: "lg",
        align: "stretch",
        className: null,
        style: null
      },
      children: [`${ns}-heading`, `${ns}-grid`]
    };
    
    // Heading
    elements[`${ns}-heading`] = {
      type: "Heading",
      props: {
        text: params.title,
        level: "h2"
      },
      children: []
    };
    
    // Grid container
    elements[`${ns}-grid`] = {
      type: "Grid",
      props: {
        columns: params.columns,
        gap: "lg",
        className: null,
        style: null
      },
      children: params.testimonials.map((_, i) => `${ns}-card-${i}`)
    };
    
    // Generate a card for each testimonial
    params.testimonials.forEach((testimonial, i) => {
      const cardId = `${ns}-card-${i}`;
      const stackId = `${ns}-stack-${i}`;
      const quoteId = `${ns}-quote-${i}`;
      const separatorId = `${ns}-separator-${i}`;
      const nameId = `${ns}-name-${i}`;
      const roleId = `${ns}-role-${i}`;
      
      elements[cardId] = {
        type: "Card",
        props: {
          title: null,
          description: null,
          maxWidth: null,
          centered: null,
          className: null
        },
        children: [stackId]
      };
      
      elements[stackId] = {
        type: "Stack",
        props: {
          direction: "vertical",
          gap: "md",
          align: "start",
          justify: null,
          className: null,
          style: null
        },
        children: [quoteId, separatorId, nameId, roleId]
      };
      
      elements[quoteId] = {
        type: "Text",
        props: {
          text: `"${testimonial.quote}"`,
          variant: "body"
        },
        children: []
      };
      
      elements[separatorId] = {
        type: "Separator",
        props: {
          orientation: "horizontal"
        },
        children: []
      };
      
      elements[nameId] = {
        type: "Text",
        props: {
          text: testimonial.name,
          variant: "body"
        },
        children: []
      };
      
      elements[roleId] = {
        type: "Text",
        props: {
          text: testimonial.role,
          variant: "muted"
        },
        children: []
      };
    });
    
    return {
      root: ns,
      elements
    };
  }
};
