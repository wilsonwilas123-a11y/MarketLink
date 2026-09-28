-- Keep an existing listing's current quantity as its recurring weekly default when its
-- template was never set. Future ISO weeks can then start from an intentional amount.
update products p
   set template_qty = ws.quantity_available
  from weekly_stock ws
 where ws.product_id = p.id
   and ws.week = iso_week()
   and p.template_qty = 0
   and ws.quantity_available > 0;
