-- AlterTable
ALTER TABLE "orders" ADD COLUMN "lat" DOUBLE PRECISION,
ADD COLUMN "lng" DOUBLE PRECISION;

-- AlterTable (make productId optional on order_items for seed/manual orders)
ALTER TABLE "order_items" ALTER COLUMN "productId" DROP NOT NULL;
