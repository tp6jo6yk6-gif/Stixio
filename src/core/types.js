// Stickio Core Data Model v1.0
// This file intentionally uses JSDoc typedefs so the current project can stay dependency-free.

/**
 * @typedef {Object} StickioProject
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {AssetRef[]} assets
 * @property {ArtworkItem[]} artworks
 * @property {Operation[]} operations
 * @property {DestinationConfig[]} destinations
 * @property {PackagePlan[]} packages
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {Object} AssetRef
 * @property {string} id
 * @property {'local'|'drive'|'url'|'embedded'} storage
 * @property {string} uri
 * @property {string} name
 * @property {string} mimeType
 * @property {number=} width
 * @property {number=} height
 * @property {number=} size
 */

/**
 * @typedef {Object} ArtworkItem
 * @property {string} id
 * @property {string} assetId
 * @property {Rect=} slice
 * @property {string=} thumbnailUri
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} Operation
 * @property {string} id
 * @property {string} type
 * @property {string|'all'} target
 * @property {Record<string, unknown>} params
 * @property {string} createdAt
 */

/**
 * @typedef {Object} DestinationConfig
 * @property {string} key
 * @property {string} rulesVersion
 * @property {Record<string, unknown>} settings
 */

/**
 * @typedef {Object} DestinationRules
 * @property {string} key
 * @property {string} name
 * @property {string} version
 * @property {{width:number,height:number}} canvas
 * @property {string[]} formats
 * @property {{top:number,right:number,bottom:number,left:number}=} safeArea
 * @property {Record<string, unknown>} validation
 * @property {Record<string, unknown>} package
 */

/**
 * @typedef {Object} RenderRequest
 * @property {ArtworkItem} artwork
 * @property {AssetRef[]} assets
 * @property {Operation[]} operations
 * @property {DestinationRules} rules
 */

/**
 * @typedef {Object} RenderedOutput
 * @property {string} artworkId
 * @property {string} destinationKey
 * @property {string} fileName
 * @property {string} mimeType
 * @property {Blob|HTMLCanvasElement|string} data
 */

/**
 * @typedef {Object} PackagePlan
 * @property {string} destinationKey
 * @property {PackageItem[]} items
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {Object} PackageItem
 * @property {string} artworkId
 * @property {string} role
 * @property {string} fileName
 * @property {number} order
 */

export const STICKIO_SCHEMA_VERSION = '1.0.0';
