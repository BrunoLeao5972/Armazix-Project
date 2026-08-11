import 'dart:convert';
import 'package:dartz/dartz.dart';
import '../../core/error/exceptions.dart';
import '../../core/error/failures.dart';
import '../../domain/entities/category_entity.dart';
import '../../domain/entities/product_entity.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../datasources/local/category_local_datasource.dart';
import '../datasources/local/product_local_datasource.dart';
import '../datasources/remote/catalog_remote_datasource.dart';
import '../models/category_model.dart';
import '../models/product_model.dart';

class CatalogRepositoryImpl implements CatalogRepository {
  final CatalogRemoteDataSource remote;
  final ProductLocalDataSource productLocal;
  final CategoryLocalDataSource categoryLocal;

  CatalogRepositoryImpl({
    required this.remote,
    required this.productLocal,
    required this.categoryLocal,
  });

  @override
  Future<Either<Failure, CatalogSyncResult>> syncCatalog(String storeId) async {
    try {
      final results = await Future.wait([remote.fetchProducts(), remote.fetchCategories()]);
      final products = results[0].map(_productFromJson).toList();
      final categories = results[1].map(_categoryFromJson).toList();

      await productLocal.upsertAll(products);
      await categoryLocal.upsertAll(categories);

      return Right((products: products.length, categories: categories.length));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, e.statusCode));
    }
  }

  ProductModel _productFromJson(Map<String, dynamic> json) {
    final imagesJson = json['images'] as List?;
    return ProductModel()
      ..remoteId = json['id'] as String
      ..storeId = json['storeId'] as String
      ..categoryId = json['categoryId'] as String?
      ..name = json['name'] as String
      ..description = json['description'] as String?
      ..imageUrl = json['imageUrl'] as String?
      ..images = (imagesJson ?? const [])
          .map((i) => ProductImageEmbedded()
            ..url = i['url'] as String
            ..isPrimary = i['isPrimary'] as bool? ?? false)
          .toList()
      ..emoji = json['emoji'] as String?
      ..price = json['price'] as String
      ..compareAtPrice = json['compareAtPrice'] as String?
      ..costPrice = json['costPrice'] as String?
      ..sku = json['sku'] as String?
      ..barcode = json['barcode'] as String?
      ..pdvCode = json['pdvCode'] as String?
      ..stock = (json['stock'] as num?)?.toInt() ?? 0
      ..lowStockThreshold = (json['lowStockThreshold'] as num?)?.toInt()
      ..unit = json['unit'] as String?
      ..badge = json['badge'] as String?
      ..productType = json['productType'] as String? ?? 'Produto'
      ..isWeightScale = json['isWeightScale'] as bool? ?? false
      ..trackStock = json['trackStock'] as bool? ?? false
      ..featured = json['featured'] as bool? ?? false
      ..active = json['active'] as bool? ?? true
      ..allowObservation = json['allowObservation'] as bool? ?? false
      ..promoConfigJson = json['promoConfig'] != null ? jsonEncode(json['promoConfig']) : null
      ..variationGroupsJson = json['variationGroups'] != null ? jsonEncode(json['variationGroups']) : null
      ..updatedAt = DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now();
  }

  CategoryModel _categoryFromJson(Map<String, dynamic> json) => CategoryModel()
    ..remoteId = json['id'] as String
    ..storeId = json['storeId'] as String
    ..parentId = json['parentId'] as String?
    ..name = json['name'] as String
    ..emoji = json['emoji'] as String?
    ..icon = json['icon'] as String?
    ..color = json['color'] as String?
    ..imageUrl = json['imageUrl'] as String?
    ..position = (json['position'] as num?)?.toInt() ?? 0
    ..active = json['active'] as bool? ?? true;

  @override
  Stream<List<ProductEntity>> watchProducts(
    String storeId, {
    String? categoryId,
    bool onlyFeatured = false,
  }) {
    return productLocal
        .watchByStore(storeId, categoryId: categoryId, onlyFeatured: onlyFeatured)
        .map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Stream<List<CategoryEntity>> watchCategories(String storeId) {
    return categoryLocal.watchByStore(storeId).map((models) => models.map((m) => m.toEntity()).toList());
  }

  @override
  Future<List<ProductEntity>> searchProducts(String storeId, String term) async {
    final models = await productLocal.search(storeId, term);
    return models.map((m) => m.toEntity()).toList();
  }
}
