/**
 * Common types shared across all Apify actors
 */

/**
 * Standard pagination options for all scrapers
 */
export interface PaginationOptions {
  /** Maximum number of results to return */
  maxResults?: number
  /** Skip first N results */
  offset?: number
}

/**
 * Date range filter options
 */
export interface DateRangeOptions {
  /** Start date (ISO string or Date object) */
  from?: string | Date
  /** End date (ISO string or Date object) */
  to?: string | Date
}

/**
 * Engagement metrics common to social media posts
 */
export interface EngagementMetrics {
  likesCount?: number
  commentsCount?: number
  sharesCount?: number
  viewsCount?: number
}

/**
 * Standard user/profile information
 */
export interface UserProfile {
  id?: string
  username?: string
  fullName?: string
  bio?: string
  profilePictureUrl?: string
  followersCount?: number
  followingCount?: number
  verified?: boolean
}

/**
 * Standard post/content structure
 */
export interface Post extends EngagementMetrics {
  id: string
  url: string
  text?: string
  caption?: string
  timestamp: string
  author?: UserProfile
  imageUrls?: string[]
  videoUrl?: string
  hashtags?: string[]
  mentions?: string[]
}

/**
 * Geo-location data
 */
export interface Location {
  latitude?: number
  longitude?: number
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

/**
 * Contact information
 */
export interface ContactInfo {
  email?: string
  phone?: string
  website?: string
  socialMedia?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
    youtube?: string
  }
}

/**
 * Business/place information
 */
export interface BusinessInfo {
  name: string
  category?: string
  rating?: number
  reviewsCount?: number
  priceLevel?: number
  location?: Location
  contact?: ContactInfo
  openingHours?: string[]
  isOpen?: boolean
}

/**
 * Actor run options for controlling execution
 */
export interface ActorRunOptions {
  /** Memory allocation in MB (128, 256, 512, 1024, 2048, 4096, 8192) */
  memory?: number
  /** Timeout in seconds */
  timeout?: number
  /** Build tag or number to use */
  build?: string
}

/**
 * Error result when actor fails
 */
export interface ActorError {
  message: string
  actorId: string
  runId?: string
  status?: string
}
