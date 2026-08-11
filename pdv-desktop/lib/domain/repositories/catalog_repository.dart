import 'package:dartz/dartz.dart';
import '../../core/error/failures.dart';
import '../entities/category_entity.dart';
import '../entities/product_entity.dart';

typedef CatalogSyncResult = ({int products, int categories});

abstract class CatalogRepository {
  /// Baixa produtos + categorias da API e grava no banco local (upsert).
  Future<Either<Failure, CatalogSyncResult>> syncCatalog(String storeId);

  /// Query reativa — reflete mudanças no banco local em tempo real.
  Stream<List<ProductEntity>> watchProducts(
    String storeId, {
    String? categoryId,
    bool onlyFeatured = false,
  });

  Stream<List<CategoryEntity>> watchCategories(String storeId);

  Future<List<ProductEntity>> searchProducts(String storeId, String term);
}
