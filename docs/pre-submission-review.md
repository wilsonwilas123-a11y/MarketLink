# MarketLink pre-submission review

**Reviewed:** 28 September 2026  
**Build:** `npm run build` passed for the API and client.

## Screens reviewed

The running local site was opened at a narrow/mobile viewport. The sign-in and private admin sign-in screens, product catalogue and card grid, markets list, farmer directory, and About page were visually reviewed. Product cards showed their crop photos, market cards showed market photography, and the catalogue exposed the seeded products and market names. The public navigation is hidden on the private admin sign-in page; it appears again after admin sign-in.

Routes that require buyer, seller, or administrator credentials were not signed into during this sweep. Their route protection and code were included in the build, but the protected dashboards still need a human sign-in review before a judged presentation.

## Image-source and fallback review

- Farmer directory/profile photos use Unsplash images for demo stalls, keep farmer-uploaded covers as the first choice, and fall back to bundled local photos when the remote source fails. These stock photos are labeled as representative imagery; they are not portraits of the named farmers.
- The product photo resolver references 51 local image paths; all 51 files exist.
- Farmer images are loaded from the Unsplash CDN with local fallbacks, so those remote photos need network access to display.
- Product cards try the listing photo, then the matching local crop photo, then crop-specific fallback artwork. A dead remote photo URL therefore does not leave an empty image panel.
- The product grid now shows only listings with an image and claims each photo once per visible result set. Repeated listings can use another distinct crop photo; if none is available, that duplicate-photo card is omitted from the grid.
- Market discovery includes externally sourced market photos with source links in the interface. Keep the displayed attribution when presenting those cards.
- The three seeded Lagos markets use local Mile 12, Oshodi, and Oyingbo photos. Their directory rows now use larger landscape thumbnails in separate rounded cards, alongside the live map.

## Motion and responsive UI

Shared reveal, card, and button motion is implemented. Reduced-motion preferences disable reveal and interaction movement. The mobile review showed the header, filters, and image-led product cards fitting the narrow viewport without side gutters or horizontal overflow in the observed pages.

## Before presenting

- Set the private admin password in `server/.env` and restart the API if the admin dashboard will be demonstrated. The checked-in example is intentionally blank.
- Configure approved public contact details in `client/.env` (`VITE_CONTACT_EMAIL`, phone/address and map coordinates) if the Contact page is part of the presentation.
- Sign in with the planned buyer and seller demo accounts and walk through their account and dashboard pages. The local sweep did not authenticate to protected pages.
- Record the requested product walkthrough using [the demo script](demo-video-script.md) if the submission asks for a video.

No automated test suite was run as part of this visual review.
