-- Rename the seeded mixed-vegetable basket on databases where the seed was already applied.
update products
   set name = 'Super Basket', updated_at = now()
 where id = md5('ml-product-basket-soup')::uuid
   and name = 'Soup Basket';
