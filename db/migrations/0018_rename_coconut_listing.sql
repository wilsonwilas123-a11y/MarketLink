-- Rename the seeded Coconut (Cold) listing to Coconut on existing databases.
update products
   set name = 'Coconut',
       description = 'Fresh coconut, husk trimmed.',
       updated_at = now()
 where id = md5('ml-product-coconut')::uuid
   and name = 'Coconut (Cold)';
