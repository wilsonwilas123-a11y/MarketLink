# Product photo storage

The API uploads product and stall photos to a Supabase Storage bucket. It accepts one JPEG,
PNG or WebP file up to 5 MB, checks the file signature, and stores each image under the
authenticated farmer's profile folder. Product URLs are saved with a listing; stall cover
and logo URLs are saved with the farmer profile.

## One-time Supabase setup

1. In Supabase Dashboard, open **Storage** and create a bucket named `product-images`.
2. Mark the bucket **public** so product cards can display its image URLs.
3. Set the bucket's maximum file size to 5 MB and, if the dashboard offers MIME restrictions,
   allow `image/jpeg`, `image/png`, and `image/webp`.
4. Set `SUPABASE_PRODUCT_BUCKET=product-images` in `server/.env` if you chose the default name.
5. Restart the API after changing the environment file.

The browser never receives the Supabase service-role key. Uploads pass through the API and
require a signed-in farmer account. Do not add a public upload policy: public access is for
reading images; the API performs writes with the server-only service role.

If the bucket does not exist or is private, the API cannot return a usable public photo URL;
create or configure the bucket before testing uploads.
