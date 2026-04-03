/**
 * Google Maps Scraper
 *
 * Apify Actor: compass/crawler-google-places (198,093 users, 4.76 rating)
 * Pricing: $0.001-$0.007 per event (Actor start + per place + optional add-ons)
 *
 * HIGHEST VALUE ACTOR - 198k users!
 * Extract Google Maps business data, reviews, contacts, images - perfect for lead generation.
 */

import { Apify } from '../../index'
import type {
  BusinessInfo,
  Location,
  ContactInfo,
  PaginationOptions,
  ActorRunOptions
} from '../../types'

/* ============================================================================
 * TYPES
 * ========================================================================= */

export interface GoogleMapsSearchInput extends PaginationOptions {
  /** Search query (e.g., "restaurants in San Francisco") */
  query: string
  /** Maximum number of places to scrape */
  maxResults?: number
  /** Include reviews for each place */
  includeReviews?: boolean
  /** Maximum reviews per place */
  maxReviewsPerPlace?: number
  /** Include images */
  includeImages?: boolean
  /** Scrape contact information from websites */
  scrapeContactInfo?: boolean
  /** Language code (en, es, fr, de, etc.) */
  language?: string
  /** Country code for search region */
  country?: string
}

export interface GoogleMapsPlaceInput {
  /** Google Maps place URL or Place ID */
  placeUrl: string
  /** Include reviews */
  includeReviews?: boolean
  /** Maximum reviews to scrape */
  maxReviews?: number
  /** Include images */
  includeImages?: boolean
  /** Scrape contact info from website */
  scrapeContactInfo?: boolean
}

export interface GoogleMapsPlace extends BusinessInfo {
  placeId: string
  name: string
  url: string
  category?: string
  categories?: string[]
  address?: string
  location?: Location
  rating?: number
  reviewsCount?: number
  priceLevel?: number
  phone?: string
  website?: string
  email?: string
  openingHours?: OpeningHours
  popularTimes?: PopularTimes[]
  isTemporarilyClosed?: boolean
  isPermanentlyClosed?: boolean
  totalScore?: number
  reviewsDistribution?: ReviewsDistribution
  imageUrls?: string[]
  reviews?: GoogleMapsReview[]
  contactInfo?: ContactInfo
  socialMedia?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  }
  verificationStatus?: string
}

export interface OpeningHours {
  monday?: string
  tuesday?: string
  wednesday?: string
  thursday?: string
  friday?: string
  saturday?: string
  sunday?: string
}

export interface PopularTimes {
  day: string
  hours: Array<{
    hour: number
    occupancyPercent: number
  }>
}

export interface ReviewsDistribution {
  oneStar?: number
  twoStar?: number
  threeStar?: number
  fourStar?: number
  fiveStar?: number
}

export interface GoogleMapsReview {
  id?: string
  text: string
  publishedAtDate: string
  rating: number
  likesCount?: number
  reviewerId?: string
  reviewerName?: string
  reviewerPhotoUrl?: string
  reviewerReviewsCount?: number
  responseFromOwner?: string
  responseFromOwnerDate?: string
  imageUrls?: string[]
}

export interface GoogleMapsReviewsInput extends PaginationOptions {
  /** Google Maps place URL */
  placeUrl: string
  /** Maximum number of reviews to scrape */
  maxResults?: number
  /** Minimum rating filter (1-5) */
  minRating?: number
  /** Language code */
  language?: string
}

/* ============================================================================
 * FUNCTIONS
 * ========================================================================= */

/**
 * Search Google Maps for places matching a query
 *
 * @param input - Search parameters
 * @param options - Actor run options
 * @returns Array of Google Maps places
 *
 * @example
 * ```typescript
 * // Search for coffee shops in SF
 * const places = await searchGoogleMaps({
 *   query: 'coffee shops in San Francisco',
 *   maxResults: 50,
 *   includeReviews: true,
 *   maxReviewsPerPlace: 10
 * })
 *
 * // Filter in code - only highly rated with many reviews
 * const topCoffeeShops = places
 *   .filter(p => p.rating >= 4.5 && p.reviewsCount >= 100)
 *   .sort((a, b) => b.rating - a.rating)
 *   .slice(0, 10)
 *
 * // Extract emails for lead generation
 * const leads = topCoffeeShops
 *   .filter(p => p.email)
 *   .map(p => ({ name: p.name, email: p.email, phone: p.phone }))
 * ```
 */
export async function searchGoogleMaps(
  input: GoogleMapsSearchInput,
  options?: ActorRunOptions
): Promise<GoogleMapsPlace[]> {
  const apify = new Apify()

  const run = await apify.callActor('compass/crawler-google-places', {
    searchStringsArray: [input.query],
    maxCrawledPlacesPerSearch: input.maxResults || 50,
    language: input.language || 'en',
    countryCode: input.country,
    includeReviews: input.includeReviews || false,
    maxReviews: input.maxReviewsPerPlace || 0,
    includeImages: input.includeImages || false,
    scrapeCompanyEmails: input.scrapeContactInfo || false,
    scrapeSocialMediaLinks: input.scrapeContactInfo || false
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Google Maps search failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  return items.map(transformPlace)
}

/**
 * Scrape detailed data for a specific Google Maps place
 *
 * @param input - Place scraping parameters
 * @param options - Actor run options
 * @returns Detailed place information
 *
 * @example
 * ```typescript
 * // Scrape a specific place with reviews
 * const place = await scrapeGoogleMapsPlace({
 *   placeUrl: 'https://maps.google.com/maps?cid=12345',
 *   includeReviews: true,
 *   maxReviews: 100,
 *   scrapeContactInfo: true
 * })
 *
 * // Filter reviews in code - only recent 5-star reviews
 * const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
 * const recentExcellent = place.reviews?.filter(r =>
 *   r.rating === 5 &&
 *   new Date(r.publishedAtDate).getTime() > thirtyDaysAgo
 * )
 * ```
 */
export async function scrapeGoogleMapsPlace(
  input: GoogleMapsPlaceInput,
  options?: ActorRunOptions
): Promise<GoogleMapsPlace> {
  const apify = new Apify()

  const run = await apify.callActor('compass/crawler-google-places', {
    startUrls: [input.placeUrl],
    includeReviews: input.includeReviews || false,
    maxReviews: input.maxReviews || 0,
    includeImages: input.includeImages || false,
    scrapeCompanyEmails: input.scrapeContactInfo || false,
    scrapeSocialMediaLinks: input.scrapeContactInfo || false
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Google Maps place scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({ limit: 1 })

  if (items.length === 0) {
    throw new Error(`Place not found: ${input.placeUrl}`)
  }

  return transformPlace(items[0])
}

/**
 * Scrape reviews for a Google Maps place
 *
 * @param input - Review scraping parameters
 * @param options - Actor run options
 * @returns Array of reviews
 *
 * @example
 * ```typescript
 * // Get 500 reviews for sentiment analysis
 * const reviews = await scrapeGoogleMapsReviews({
 *   placeUrl: 'https://maps.google.com/maps?cid=12345',
 *   maxResults: 500,
 *   language: 'en'
 * })
 *
 * // Filter in code - only detailed reviews
 * const detailedReviews = reviews.filter(r =>
 *   r.text.length > 100 &&
 *   r.imageUrls && r.imageUrls.length > 0
 * )
 *
 * // Analyze sentiment by rating
 * const negative = reviews.filter(r => r.rating <= 2)
 * const positive = reviews.filter(r => r.rating >= 4)
 * ```
 */
export async function scrapeGoogleMapsReviews(
  input: GoogleMapsReviewsInput,
  options?: ActorRunOptions
): Promise<GoogleMapsReview[]> {
  const apify = new Apify()

  const run = await apify.callActor('compass/Google-Maps-Reviews-Scraper', {
    startUrls: [input.placeUrl],
    maxReviews: input.maxResults || 100,
    reviewsSort: 'newest',
    language: input.language || 'en'
  }, options)

  await apify.waitForRun(run.id)

  const finalRun = await apify.getRun(run.id)
  if (finalRun.status !== 'SUCCEEDED') {
    throw new Error(`Google Maps reviews scraping failed: ${finalRun.status}`)
  }

  const dataset = apify.getDataset(finalRun.defaultDatasetId)
  const items = await dataset.listItems({
    limit: input.maxResults || 1000,
    offset: input.offset || 0
  })

  // Filter by rating if specified
  let reviews = items.map(transformReview)
  if (input.minRating) {
    reviews = reviews.filter(r => r.rating >= input.minRating!)
  }

  return reviews
}

/* ============================================================================
 * HELPERS
 * ========================================================================= */

/**
 * Transform raw Google Maps place data to our standard format
 */
function transformPlace(place: any): GoogleMapsPlace {
  return {
    placeId: place.placeId,
    name: place.title || place.name,
    url: place.url,
    category: place.categoryName,
    categories: place.categories || [place.categoryName],
    address: place.address,
    location: {
      latitude: place.location?.lat,
      longitude: place.location?.lng,
      address: place.address,
      city: place.city,
      state: place.state,
      country: place.countryCode,
      postalCode: place.postalCode
    },
    rating: place.totalScore,
    totalScore: place.totalScore,
    reviewsCount: place.reviewsCount,
    priceLevel: place.priceLevel,
    phone: place.phone,
    website: place.website,
    email: place.email || place.companyEmail,
    openingHours: place.openingHours,
    popularTimes: place.popularTimesHistogram,
    isTemporarilyClosed: place.temporarilyClosed,
    isPermanentlyClosed: place.permanentlyClosed,
    reviewsDistribution: place.reviewsDistribution,
    imageUrls: place.imageUrls,
    reviews: place.reviews?.map(transformReview),
    contact: {
      email: place.email || place.companyEmail,
      phone: place.phone,
      website: place.website,
      socialMedia: {
        facebook: place.facebookUrl,
        twitter: place.twitterUrl,
        instagram: place.instagramUrl,
        linkedin: place.linkedinUrl
      }
    },
    contactInfo: {
      email: place.email || place.companyEmail,
      phone: place.phone,
      website: place.website
    },
    socialMedia: {
      facebook: place.facebookUrl,
      twitter: place.twitterUrl,
      instagram: place.instagramUrl,
      linkedin: place.linkedinUrl
    },
    verificationStatus: place.claimThisBusiness
  }
}

/**
 * Transform raw Google Maps review data to our standard format
 */
function transformReview(review: any): GoogleMapsReview {
  return {
    id: review.reviewId,
    text: review.text || review.reviewText,
    publishedAtDate: review.publishedAtDate || review.publishAt,
    rating: review.stars || review.rating,
    likesCount: review.likesCount,
    reviewerId: review.reviewerId,
    reviewerName: review.name || review.reviewerName,
    reviewerPhotoUrl: review.profilePhotoUrl || review.reviewerPhotoUrl,
    reviewerReviewsCount: review.reviewerNumberOfReviews,
    responseFromOwner: review.responseFromOwnerText,
    responseFromOwnerDate: review.responseFromOwnerDate,
    imageUrls: review.reviewImageUrls
  }
}
