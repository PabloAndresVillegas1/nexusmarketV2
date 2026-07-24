import { Module } from '@nestjs/common';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { InternalProductsController } from './products/internal-products.controller';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';

@Module({
  controllers: [
    ProductsController,
    InternalProductsController,
    CategoriesController,
  ],
  providers: [ProductsService, CategoriesService],
})
export class CatalogModule {}
