import 'package:isar/isar.dart';
import '../../domain/entities/product_entity.dart';

part 'product_model.g.dart';

@embedded
class ProductImageEmbedded {
  String url = '';
  bool isPrimary = false;

  ProductImageEntity toEntity() => ProductImageEntity(url: url, isPrimary: isPrimary);

  static ProductImageEmbedded fromEntity(ProductImageEntity e) => ProductImageEmbedded()
    ..url = e.url
    ..isPrimary = e.isPrimary;
}

@collection
class ProductModel {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: true)
  late String remoteId;

  @Index(composite: [CompositeIndex('active')])
  late String storeId;

  String? categoryId;

  late String name;
  String? description;
  String? imageUrl;
  List<ProductImageEmbedded> images = [];
  String? emoji;

  /// Decimal como string ("12.90") — mesma convenção do backend.
  late String price;
  String? compareAtPrice;
  String? costPrice;
  String? sku;
  String? barcode;
  String? pdvCode;

  int stock = 0;
  int? lowStockThreshold;
  String? unit;
  String? badge;
  String productType = 'Produto';
  bool isWeightScale = false;
  bool trackStock = false;
  bool featured = false;
  bool active = true;
  bool allowObservation = false;

  /// promoConfig/variationGroups do backend são JSON de forma variável —
  /// guardados crus (string) só pra round-trip futuro, não interpretados
  /// nesta v1 do PDV (grid simples, sem seletor de variação ainda).
  String? promoConfigJson;
  String? variationGroupsJson;

  DateTime updatedAt = DateTime.now();

  ProductEntity toEntity() => ProductEntity(
        remoteId: remoteId,
        storeId: storeId,
        categoryId: categoryId,
        name: name,
        description: description,
        imageUrl: imageUrl,
        images: images.map((i) => i.toEntity()).toList(),
        emoji: emoji,
        price: price,
        barcode: barcode,
        pdvCode: pdvCode,
        sku: sku,
        stock: stock,
        trackStock: trackStock,
        active: active,
        featured: featured,
      );
}
