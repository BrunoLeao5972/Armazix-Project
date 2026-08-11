import 'package:isar/isar.dart';
import '../../models/product_model.dart';

abstract class ProductLocalDataSource {
  Future<void> upsertAll(List<ProductModel> products);
  Stream<List<ProductModel>> watchByStore(
    String storeId, {
    String? categoryId,
    bool onlyFeatured = false,
  });
  Future<List<ProductModel>> search(String storeId, String term);
}

class ProductLocalDataSourceImpl implements ProductLocalDataSource {
  final Isar isar;
  const ProductLocalDataSourceImpl(this.isar);

  @override
  Future<void> upsertAll(List<ProductModel> products) async {
    await isar.writeTxn(() async {
      await isar.productModels.putAll(products);
    });
  }

  @override
  Stream<List<ProductModel>> watchByStore(
    String storeId, {
    String? categoryId,
    bool onlyFeatured = false,
  }) {
    final Query<ProductModel> query;
    if (onlyFeatured) {
      query = isar.productModels
          .filter()
          .storeIdEqualTo(storeId)
          .activeEqualTo(true)
          .featuredEqualTo(true)
          .build();
    } else if (categoryId != null) {
      query = isar.productModels
          .filter()
          .storeIdEqualTo(storeId)
          .activeEqualTo(true)
          .categoryIdEqualTo(categoryId)
          .build();
    } else {
      query = isar.productModels.filter().storeIdEqualTo(storeId).activeEqualTo(true).build();
    }
    return query.watch(fireImmediately: true);
  }

  @override
  Future<List<ProductModel>> search(String storeId, String term) {
    return isar.productModels
        .filter()
        .storeIdEqualTo(storeId)
        .activeEqualTo(true)
        .and()
        .group((q) => q
            .nameContains(term, caseSensitive: false)
            .or()
            .barcodeEqualTo(term)
            .or()
            .pdvCodeEqualTo(term)
            .or()
            .skuContains(term, caseSensitive: false))
        .findAll();
  }
}
