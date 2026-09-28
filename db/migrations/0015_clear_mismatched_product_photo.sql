-- The demo tatashe listing once reused a mixed-vegetable basket photograph. Remove that
-- specific bundled image from existing installs; the product card will show its pepper art.
-- Farmer-uploaded or otherwise curated photos are preserved.
update products
   set image_urls = '{}'::text[], updated_at = now()
 where id = md5('ml-product-tatashe-crate')::uuid
   and image_urls @> array['/img/products/ugu.jpg']::text[];
