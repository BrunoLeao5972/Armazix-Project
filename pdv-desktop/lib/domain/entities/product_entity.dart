import 'package:equatable/equatable.dart';

class ProductImageEntity extends Equatable {
  final String url;
  final bool isPrimary;
  const ProductImageEntity({required this.url, required this.isPrimary});

  @override
  List<Object?> get props => [url, isPrimary];
}

class ProductEntity extends Equatable {
  final String remoteId;
  final String storeId;
  final String? categoryId;
  final String name;
  final String? description;
  final String? imageUrl;
  final List<ProductImageEntity> images;
  final String? emoji;

  /// Sempre string decimal ("12.90"), nunca double — mesma convenção do backend.
  final String price;
  final String? barcode;
  final String? pdvCode;
  final String? sku;
  final int stock;
  final bool trackStock;
  final bool active;
  final bool featured;

  const ProductEntity({
    required this.remoteId,
    required this.storeId,
    this.categoryId,
    required this.name,
    this.description,
    this.imageUrl,
    this.images = const [],
    this.emoji,
    required this.price,
    this.barcode,
    this.pdvCode,
    this.sku,
    this.stock = 0,
    this.trackStock = false,
    this.active = true,
    this.featured = false,
  });

  bool get isOutOfStock => trackStock && stock <= 0;

  @override
  List<Object?> get props => [remoteId, name, price, stock, active, categoryId];
}
