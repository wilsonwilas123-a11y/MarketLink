-- The demo Ugu listing previously pointed at a mixed produce photo. There is no
-- dependable Ugu close-up in the bundled assets, so let the client show the leaf art.
update products
   set image_urls = '{}'::text[], updated_at = now()
 where id = md5('ml-product-ugu-500')::uuid
   and image_urls @> array['/img/products/ugu.jpg']::text[];
