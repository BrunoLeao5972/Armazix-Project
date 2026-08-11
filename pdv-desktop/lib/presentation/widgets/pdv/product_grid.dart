import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../domain/entities/product_entity.dart';
import 'product_card.dart';

class ProductGrid extends StatelessWidget {
  final List<ProductEntity> products;
  final ValueChanged<ProductEntity> onAdd;

  const ProductGrid({super.key, required this.products, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inventory_2_outlined, size: 40, color: AppColors.inkMuted),
            SizedBox(height: 8),
            Text('Nenhum produto encontrado', style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
          ],
        ),
      );
    }
    return GridView.builder(
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 190,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.78,
      ),
      itemCount: products.length,
      itemBuilder: (context, i) {
        final product = products[i];
        return ProductCard(product: product, onTap: () => onAdd(product));
      },
    );
  }
}
