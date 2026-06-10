/**
 * Shared geometry for the proposal signature block.
 *
 * The proposal template (components/pdf/proposal-document.tsx) pins the
 * signature block at an absolute position on the page so the post-sign
 * stamper (lib/pdf/embed-signature.ts) can draw the captured signature
 * exactly on the SIGNED FOR CLIENT rule. Both files MUST read from these
 * constants — move the block here and the stamp follows automatically.
 *
 * All values are PDF points. pdf-lib's origin is the page's bottom-left.
 */

export const A4_WIDTH = 595.28

/** Horizontal page padding in the template. */
export const PAGE_MARGIN_X = 40

/**
 * Vertical space reserved at the page bottom (template paddingBottom) so
 * flowing content never runs into the pinned signature block or footer.
 */
export const PAGE_BOTTOM_RESERVED = 180

/** Gap between the client and 888 signature columns. */
export const SIG_GAP = 40

/** Distance from page bottom to the bottom edge of the signature block. */
export const SIG_BLOCK_BOTTOM = 80

/** Width of each signature column (two columns + gap inside the margins). */
export const SIG_BLOCK_WIDTH = (A4_WIDTH - PAGE_MARGIN_X * 2 - SIG_GAP) / 2

/** Height of the signing area above the rule. */
export const SIG_SPACE_HEIGHT = 40

/** Left inset of content inside the signing area. */
export const SIG_SPACE_PADDING_LEFT = 10

/** Approx rendered height of the 8pt meta caption under the rule. */
export const SIG_META_HEIGHT = 10

/** Template marginBottom between the rule and the meta caption. */
export const SIG_META_MARGIN_TOP = 10

/** Y of the client signature rule (the borderBottom of sigSpace). */
export const SIG_LINE_Y = SIG_BLOCK_BOTTOM + SIG_META_HEIGHT + SIG_META_MARGIN_TOP

/** Where the stamped signature image is anchored. */
export const SIG_IMAGE_X = PAGE_MARGIN_X + SIG_SPACE_PADDING_LEFT
export const SIG_IMAGE_MAX_WIDTH = SIG_BLOCK_WIDTH - SIG_SPACE_PADDING_LEFT * 2
// Image bottom sits at SIG_LINE_Y + 2; the block label starts ~150pt up, so
// cap height to keep the signature clear of the "SIGNED FOR CLIENT" label.
export const SIG_IMAGE_MAX_HEIGHT = 44
