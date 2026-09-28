-- Customers who saved an item should know when a farmer makes it available again.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('order_placed', 'order_accepted', 'order_ready',
                  'order_cancelled', 'stock_low', 'restock', 'announcement'));
