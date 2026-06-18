/**
 * ImageGallery — a product image gallery: a main image carousel (arrows +
 * swipe) with a synced thumbnail strip below. Clicking a thumbnail jumps the
 * main image; paging the main highlights the active thumbnail. Encapsulates
 * the canonical embla "main + thumbs" two-carousel sync, which can't be wired
 * from the json-render spec (embla owns its slide index internally).
 *
 * `images` accepts plain URL strings or objects ({ image } / { url }) so it can
 * be fed a Product.Images array directly. Display-only (no binding). Registered
 * via ./index.ts.
 */
import { type BaseComponentProps } from "@json-render/react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { z } from "zod"
import { cn } from "@/lib/utils"

type ImageItem = string | { image?: string | null; url?: string | null }

interface ImageGalleryProps {
	images: ImageItem[]
	aspectRatio?: string | null
	alt?: string | null
	className?: string | null
}

const toUrl = (it: ImageItem): string =>
	typeof it === "string" ? it : (it?.image ?? it?.url ?? "")

function ImageGallery({ props }: BaseComponentProps<ImageGalleryProps>) {
	const images = (Array.isArray(props.images) ? props.images : []).map(toUrl).filter(Boolean)
	const ar = props.aspectRatio || "1/1"

	const [mainRef, mainApi] = useEmblaCarousel()
	const [thumbRef, thumbApi] = useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true })
	const [selected, setSelected] = useState(0)

	const onThumb = useCallback((i: number) => mainApi?.scrollTo(i), [mainApi])
	const onSelect = useCallback(() => {
		if (!mainApi) return
		const i = mainApi.selectedScrollSnap()
		setSelected(i)
		thumbApi?.scrollTo(i)
	}, [mainApi, thumbApi])

	useEffect(() => {
		if (!mainApi) return
		onSelect()
		mainApi.on("select", onSelect).on("reInit", onSelect)
	}, [mainApi, onSelect])

	if (images.length === 0) {
		return (
			<div
				className={cn("flex items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground", props.className)}
				style={{ aspectRatio: ar }}
			>
				No images
			</div>
		)
	}

	const arrowBtn =
		"absolute top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background disabled:opacity-0"

	return (
		<div className={cn("flex flex-col gap-2", props.className)}>
			{/* Main viewport */}
			<div className="relative">
				<div ref={mainRef} className="overflow-hidden rounded-xl border border-border">
					<div className="flex">
						{images.map((src, i) => (
							<div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
								<div className="bg-muted" style={{ aspectRatio: ar }}>
									<img src={src} alt={props.alt ?? ""} className="h-full w-full object-cover" />
								</div>
							</div>
						))}
					</div>
				</div>
				{images.length > 1 && (
					<>
						<button type="button" aria-label="Previous image" onClick={() => mainApi?.scrollPrev()} className={cn(arrowBtn, "left-2")}>
							<ChevronLeft className="size-4" />
						</button>
						<button type="button" aria-label="Next image" onClick={() => mainApi?.scrollNext()} className={cn(arrowBtn, "right-2")}>
							<ChevronRight className="size-4" />
						</button>
					</>
				)}
			</div>

			{/* Thumbnail strip */}
			{images.length > 1 && (
				<div ref={thumbRef} className="overflow-hidden">
					<div className="flex gap-2">
						{images.map((src, i) => (
							<button
								key={i}
								type="button"
								aria-label={`View image ${i + 1}`}
								aria-current={selected === i}
								onClick={() => onThumb(i)}
								className={cn(
									"size-16 shrink-0 overflow-hidden rounded-lg border transition",
									selected === i ? "border-primary ring-2 ring-ring" : "border-border opacity-70 hover:opacity-100"
								)}
							>
								<img src={src} alt="" className="h-full w-full object-cover" />
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export const definition = {
	props: z.object({
		images: z
			.array(z.union([z.string(), z.object({ image: z.string().nullable(), url: z.string().nullable() }).partial()]))
			.describe("Image URLs — plain strings or objects ({ image } / { url }). Feed a Product.Images array directly."),
		aspectRatio: z.string().nullable().describe("Main + thumbnail aspect ratio, e.g. '1/1', '4/3' (default '1/1')."),
		alt: z.string().nullable(),
		className: z.string().nullable()
	}),
	description:
		"Product image gallery: a main image carousel (arrows + swipe) with a synced thumbnail strip below " +
		"(click a thumb to jump; active thumb highlighted). Use on a product detail page; pass Product.Images.",
	example: {
		aspectRatio: "1/1",
		images: [
			"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=320",
			"https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=320"
		]
	}
}

export const component = ImageGallery
